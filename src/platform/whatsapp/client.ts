import crypto from 'crypto';
import { env } from '../../config/env';
import { db } from '../../db';

interface MetaResponse {
    messages?: Array<{ id: string }>;
    error?: { message?: string; code?: number; error_data?: { details?: string } };
}

const send = async (
    waId: string,
    messageType: string,
    payload: Record<string, unknown>,
    templateName?: string,
    idempotencyKey?: string
) => {
    if (!env.metaAccessToken || !env.metaPhoneNumberId) throw new Error('Meta sending credentials are not configured');
    const operationKey = idempotencyKey || `generated:${crypto.randomUUID()}`;
    const claimed = await db.query(
        `INSERT INTO whatsapp_outbound_messages (wa_id, message_type, template_name, idempotency_key)
         VALUES ($1, $2, $3, $4) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [waId, messageType, templateName || null, operationKey]
    );
    if (!claimed.rowCount) {
        const existing = await db.query(
            'SELECT meta_message_id, failed_at, error_details FROM whatsapp_outbound_messages WHERE idempotency_key = $1',
            [operationKey]
        );
        if (existing.rows[0]?.failed_at) throw new Error(existing.rows[0].error_details || 'Previous Meta send failed');
        return existing.rows[0]?.meta_message_id as string | undefined;
    }
    const outboundId = claimed.rows[0].id;
    try {
        const response = await fetch(
            `https://graph.facebook.com/${env.metaGraphVersion}/${env.metaPhoneNumberId}/messages`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${env.metaAccessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: waId, ...payload }),
                signal: AbortSignal.timeout(10000)
            }
        );
        const body = await response.json() as MetaResponse;
        if (!response.ok || body.error) {
            throw new Error(`Meta API ${body.error?.code || response.status}: ${body.error?.message || body.error?.error_data?.details || 'request failed'}`);
        }
        const messageId = body.messages?.[0]?.id;
        await db.query(
            `UPDATE whatsapp_outbound_messages SET meta_message_id = $2, accepted_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [outboundId, messageId || null]
        );
        return messageId;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.query(
            `UPDATE whatsapp_outbound_messages SET failed_at = CURRENT_TIMESTAMP, error_details = $2 WHERE id = $1`,
            [outboundId, message.slice(0, 2000)]
        );
        throw error;
    }
};

export const sendText = (waId: string, text: string, idempotencyKey?: string) =>
    send(waId, 'text', { type: 'text', text: { preview_url: false, body: text } }, undefined, idempotencyKey);

export const sendTemplate = (waId: string, name: string, languageCode: string, urlSuffix?: string, idempotencyKey?: string) => {
    const components = urlSuffix ? [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlSuffix }] }] : undefined;
    return send(waId, 'template', {
        type: 'template',
        template: { name, language: { code: languageCode }, ...(components ? { components } : {}) }
    }, name, idempotencyKey);
};
