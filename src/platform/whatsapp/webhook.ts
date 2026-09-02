import crypto from 'crypto';
import { RequestHandler } from 'express';
import { env } from '../../config/env';
import { db } from '../../db';
import { verifyMetaSignature } from './signature';
import { processWebhookInbox } from '../../jobs/webhookWorker';

export const verifyWebhook: RequestHandler = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && typeof token === 'string' && token === env.metaVerifyToken && env.metaVerifyToken) {
        res.status(200).send(typeof challenge === 'string' ? challenge : '');
        return;
    }
    res.sendStatus(403);
};

export const receiveWebhook: RequestHandler = async (req, res) => {
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody) || !verifyMetaSignature(rawBody, req.header('x-hub-signature-256'), env.metaAppSecret)) {
        res.sendStatus(401);
        return;
    }
    try {
        const payload = JSON.parse(rawBody.toString('utf8'));
        if (payload?.object !== 'whatsapp_business_account') {
            res.sendStatus(400);
            return;
        }
        const eventKey = crypto.createHash('sha256').update(rawBody).digest('hex');
        await db.query(
            `INSERT INTO whatsapp_webhook_inbox (event_key, payload) VALUES ($1, $2::jsonb)
             ON CONFLICT (event_key) DO NOTHING`,
            [eventKey, JSON.stringify(payload)]
        );
        res.sendStatus(200);
        setImmediate(() => processWebhookInbox().catch((error) => console.error('[webhook-worker] failed', error)));
    } catch (error) {
        console.error('[whatsapp-webhook] failed to persist webhook', error);
        res.sendStatus(500);
    }
};
