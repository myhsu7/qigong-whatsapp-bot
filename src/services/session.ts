import crypto from 'crypto';
import { env } from '../config/env';
import { db } from '../db';

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

export const issueMagicLink = async (waId: string, purpose = 'checkin') => {
    if (!env.publicBaseUrl) throw new Error('PUBLIC_BASE_URL is not configured');
    const token = randomToken();
    await db.query(
        `INSERT INTO whatsapp_magic_links (token_hash, wa_id, purpose, expires_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 minute'))`,
        [hash(token), waId, purpose, env.magicLinkTtlMinutes]
    );
    return `${env.publicBaseUrl}/whatsapp/webapp/auth?t=${encodeURIComponent(token)}`;
};

export const consumeMagicLink = async (token: string) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const link = await client.query(
            `UPDATE whatsapp_magic_links SET consumed_at = CURRENT_TIMESTAMP
             WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP
             RETURNING wa_id, purpose`,
            [hash(token)]
        );
        if (!link.rowCount) throw new Error('連結無效或已過期');
        const session = randomToken();
        await client.query(
            `INSERT INTO whatsapp_web_sessions (session_hash, wa_id, expires_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 hour'))`,
            [hash(session), link.rows[0].wa_id, env.sessionTtlHours]
        );
        await client.query('COMMIT');
        return { session, waId: link.rows[0].wa_id as string, purpose: link.rows[0].purpose as string };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const resolveSession = async (session: string) => {
    if (!session) return null;
    const { rows } = await db.query(
        `SELECT wa_id FROM whatsapp_web_sessions
         WHERE session_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [hash(session)]
    );
    return rows[0]?.wa_id as string | undefined || null;
};
