import { db } from '../db';
import { upsertWhatsAppUser } from '../services/checkin';
import { routeInboundMessage } from '../platform/whatsapp/messageRouter';
import { maxWebhookAttempts, webhookRetryDelaySeconds } from './retryPolicy';

interface WhatsAppMessage {
    id?: string;
    from?: string;
    type?: string;
    text?: { body?: string };
    interactive?: {
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
    };
}

const getMessageText = (message: WhatsAppMessage) => message.text?.body
    || message.interactive?.button_reply?.id
    || message.interactive?.button_reply?.title
    || message.interactive?.list_reply?.id
    || message.interactive?.list_reply?.title
    || '';

const processStatuses = async (statuses: Array<Record<string, any>>) => {
    for (const status of statuses) {
        if (!status.id || !['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const column = `${status.status}_at`;
        const error = status.errors?.[0];
        const eventTimestamp = /^\d+$/.test(String(status.timestamp || '')) ? Number(status.timestamp) : null;
        await db.query(
            `UPDATE whatsapp_outbound_messages SET ${column} = COALESCE(to_timestamp($4), CURRENT_TIMESTAMP),
             error_code = COALESCE($2, error_code), error_details = COALESCE($3, error_details)
             WHERE meta_message_id = $1`,
            [status.id, error?.code ? String(error.code) : null, error?.message || error?.error_data?.details || null, eventTimestamp]
        );
    }
};

const processInboundMessage = async (inboxId: string, message: WhatsAppMessage, profileName?: string) => {
    if (!message.id || !message.from) return;
    await upsertWhatsAppUser(message.from, profileName);
    const inserted = await db.query(
        `INSERT INTO whatsapp_inbound_messages (message_id, inbox_id, wa_id, payload, claimed_at, attempt_count)
         VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP, 1)
         ON CONFLICT (message_id) DO NOTHING RETURNING message_id`,
        [message.id, inboxId, message.from, JSON.stringify(message)]
    );
    let claimed = Boolean(inserted.rowCount);
    if (!claimed) {
        const retried = await db.query(
            `UPDATE whatsapp_inbound_messages
             SET claimed_at = CURRENT_TIMESTAMP, attempt_count = attempt_count + 1, last_error = NULL
             WHERE message_id = $1 AND processed_at IS NULL
               AND (claimed_at IS NULL OR claimed_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
             RETURNING message_id`,
            [message.id]
        );
        claimed = Boolean(retried.rowCount);
    }
    if (!claimed) return;
    try {
        const text = getMessageText(message);
        if (text) await routeInboundMessage(message.from, text, message.id);
        await db.query(
            'UPDATE whatsapp_inbound_messages SET processed_at = CURRENT_TIMESTAMP, last_error = NULL WHERE message_id = $1',
            [message.id]
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await db.query(
            'UPDATE whatsapp_inbound_messages SET claimed_at = NULL, last_error = $2 WHERE message_id = $1',
            [message.id, errorMessage.slice(0, 2000)]
        );
        throw error;
    }
};

const processPayload = async (inboxId: string, payload: Record<string, any>) => {
    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value || {};
            await processStatuses(value.statuses || []);
            const profileByWaId = new Map<string, string>();
            for (const contact of value.contacts || []) {
                if (contact.wa_id) profileByWaId.set(contact.wa_id, contact.profile?.name || '');
            }
            for (const message of (value.messages || []) as WhatsAppMessage[]) {
                await processInboundMessage(inboxId, message, message.from ? profileByWaId.get(message.from) : undefined);
            }
        }
    }
};

let running = false;

export const processWebhookInbox = async () => {
    if (running) return;
    running = true;
    try {
        while (true) {
            const client = await db.getClient();
            let item: { id: string; payload: Record<string, any>; attemptCount: number } | undefined;
            try {
                await client.query('BEGIN');
                const claimed = await client.query(
                    `SELECT id, payload FROM whatsapp_webhook_inbox
                     WHERE processed_at IS NULL
                        AND dead_lettered_at IS NULL
                        AND attempt_count < $1
                        AND next_attempt_at <= CURRENT_TIMESTAMP
                        AND (claimed_at IS NULL OR claimed_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
                     ORDER BY next_attempt_at, received_at FOR UPDATE SKIP LOCKED LIMIT 1`,
                    [maxWebhookAttempts]
                );
                if (!claimed.rowCount) {
                    await client.query('COMMIT');
                    break;
                }
                const selected = claimed.rows[0];
                const updated = await client.query(
                    `UPDATE whatsapp_webhook_inbox
                     SET claimed_at = CURRENT_TIMESTAMP, attempt_count = attempt_count + 1
                     WHERE id = $1 RETURNING id, payload, attempt_count`,
                    [selected.id]
                );
                item = { id: updated.rows[0].id, payload: updated.rows[0].payload, attemptCount: updated.rows[0].attempt_count };
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

            try {
                await processPayload(item!.id, item!.payload);
                await db.query('UPDATE whatsapp_webhook_inbox SET processed_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = $1', [item!.id]);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const deadLettered = item!.attemptCount >= maxWebhookAttempts;
                const delaySeconds = webhookRetryDelaySeconds(item!.attemptCount);
                await db.query(
                    `UPDATE whatsapp_webhook_inbox
                     SET claimed_at = NULL,
                         last_error = $2,
                         next_attempt_at = CASE WHEN $3 THEN next_attempt_at ELSE CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second') END,
                         dead_lettered_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE dead_lettered_at END
                     WHERE id = $1`,
                    [item!.id, message.slice(0, 2000), deadLettered, delaySeconds]
                );
                console.error(`[webhook-worker] event ${item!.id} ${deadLettered ? 'dead-lettered' : `retrying in ${delaySeconds}s`}`, message);
            }
        }
    } finally {
        running = false;
    }
};
