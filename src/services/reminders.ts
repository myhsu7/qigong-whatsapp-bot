import moment from 'moment-timezone';
import { db } from '../db';

export interface ReminderSettings {
    reminderEnabled: boolean;
    reminderHour: number;
    reminderTimezone: string;
}

export const getReminderSettings = async (waId: string): Promise<ReminderSettings> => {
    const { rows } = await db.query(
        'SELECT reminder_enabled, reminder_hour, reminder_timezone FROM whatsapp_users WHERE wa_id = $1',
        [waId]
    );
    if (!rows.length) throw new Error('找不到使用者');
    return {
        reminderEnabled: rows[0].reminder_enabled,
        reminderHour: Number(rows[0].reminder_hour),
        reminderTimezone: rows[0].reminder_timezone
    };
};

export const updateReminderSettings = async (waId: string, updates: Partial<ReminderSettings>) => {
    const current = await getReminderSettings(waId);
    const next = { ...current, ...updates };
    if (!Number.isInteger(next.reminderHour) || next.reminderHour < 0 || next.reminderHour > 23) {
        throw new Error('提醒時間必須介於 0 到 23 點');
    }
    if (!moment.tz.zone(next.reminderTimezone)) throw new Error('無效的時區');
    await db.query(
        `UPDATE whatsapp_users SET reminder_enabled = $2, reminder_hour = $3, reminder_timezone = $4,
         reminder_opted_in_at = CASE WHEN $2 THEN COALESCE(reminder_opted_in_at, CURRENT_TIMESTAMP) ELSE reminder_opted_in_at END,
         reminder_opted_out_at = CASE WHEN $2 THEN NULL ELSE CURRENT_TIMESTAMP END,
         updated_at = CURRENT_TIMESTAMP WHERE wa_id = $1`,
        [waId, next.reminderEnabled, next.reminderHour, next.reminderTimezone]
    );
    return next;
};
