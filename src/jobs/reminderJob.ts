import cron from 'node-cron';
import moment from 'moment-timezone';
import { env } from '../config/env';
import { db } from '../db';
import { sendTemplate } from '../platform/whatsapp/client';

interface Recipient {
    wa_id: string;
    reminder_hour: number;
    reminder_timezone: string;
}

export const runReminderJob = async () => {
    const lockClient = await db.getClient();
    try {
        const lock = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired', ['whatsapp-reminder-job']);
        if (!lock.rows[0]?.acquired) return { attempted: 0, sent: 0 };
        const recipients = await db.query(
            `SELECT wa_id, reminder_hour, reminder_timezone FROM whatsapp_users
             WHERE reminder_enabled = TRUE AND is_blocked = FALSE ORDER BY wa_id`
        );
        let attempted = 0;
        let sent = 0;
        for (const recipient of recipients.rows as Recipient[]) {
            const localNow = moment().tz(recipient.reminder_timezone);
            if (localNow.hour() !== Number(recipient.reminder_hour)) continue;
            const localDate = localNow.format('YYYY-MM-DD');
            const alreadyCheckedIn = await db.query(
                'SELECT 1 FROM whatsapp_checkin_logs WHERE wa_id = $1 AND checkin_date = $2',
                [recipient.wa_id, localDate]
            );
            if (alreadyCheckedIn.rowCount) continue;
            const delivery = await db.query(
                `INSERT INTO whatsapp_reminder_deliveries (wa_id, local_date, template_name)
                 VALUES ($1, $2, $3) ON CONFLICT (wa_id, local_date, reminder_kind) DO NOTHING RETURNING id`,
                [recipient.wa_id, localDate, env.reminderTemplate]
            );
            if (!delivery.rowCount) continue;
            attempted += 1;
            try {
                const messageId = await sendTemplate(
                    recipient.wa_id,
                    env.reminderTemplate,
                    env.reminderTemplateLanguage,
                    undefined,
                    `reminder:${recipient.wa_id}:${localDate}:daily`
                );
                await db.query(
                    `UPDATE whatsapp_reminder_deliveries SET status = 'accepted', meta_message_id = $2,
                     updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [delivery.rows[0].id, messageId || null]
                );
                sent += 1;
            } catch (error) {
                await db.query(
                    `UPDATE whatsapp_reminder_deliveries SET status = 'failed', error_details = $2,
                     updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [delivery.rows[0].id, (error instanceof Error ? error.message : String(error)).slice(0, 2000)]
                );
            }
        }
        return { attempted, sent };
    } finally {
        try {
            await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', ['whatsapp-reminder-job']);
        } finally {
            lockClient.release();
        }
    }
};

export const setupReminderJob = () => {
    if (!env.reminderEnabled) {
        console.log('[reminder] disabled');
        return;
    }
    cron.schedule('0 * * * *', () => {
        runReminderJob()
            .then(({ attempted, sent }) => console.log(`[reminder] sent ${sent}/${attempted}`))
            .catch((error) => console.error('[reminder] job failed', error));
    }, { timezone: 'Asia/Taipei' });
    console.log('[reminder] scheduled hourly');
};
