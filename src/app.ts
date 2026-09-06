import express, { ErrorRequestHandler } from 'express';
import path from 'path';
import { receiveWebhook, verifyWebhook } from './platform/whatsapp/webhook';
import webappRoutes from './routes/webapp';
import apiRoutes from './routes/api';
import { db } from './db';
import { missingRuntimeConfiguration } from './config/env';
import { checkMetaCredentials } from './services/metaHealth';
import { checkLocalLlm } from './services/localLlm';

export const createApp = () => {
    const app = express();

    app.get('/whatsapp/webhook', verifyWebhook);
    app.post('/whatsapp/webhook', express.raw({ type: 'application/json', limit: '1mb' }), receiveWebhook);

    app.use(express.json({ limit: '32kb' }));
    app.use('/whatsapp/public', express.static(path.join(process.cwd(), 'dist', 'public')));
    app.use('/whatsapp/webapp', webappRoutes);
    app.use('/whatsapp/api/webapp', apiRoutes);

    app.get('/', (_req, res) => res.json({ ok: true, service: 'qigong-whatsapp-bot' }));
    app.get('/health/live', (_req, res) => res.json({ ok: true }));
    app.get('/whatsapp/health/live', (_req, res) => res.json({ ok: true }));
    app.get('/whatsapp/health/ready', async (_req, res) => {
        const missing = missingRuntimeConfiguration();
        if (missing.length) {
            res.status(503).json({ ok: false, reason: 'missing_configuration', missing });
            return;
        }
        try {
            await db.query('SELECT 1');
            res.json({ ok: true });
        } catch {
            res.status(503).json({ ok: false, reason: 'database_unavailable' });
        }
    });
    app.get('/whatsapp/health/meta', async (_req, res) => {
        const health = await checkMetaCredentials();
        res.status(health.ok ? 200 : 503).json(health);
    });
    app.get('/whatsapp/health/llm', async (_req, res) => {
        const health = await checkLocalLlm();
        res.status(health.ok ? 200 : 503).json(health);
    });
    app.get('/whatsapp/health/queue', async (_req, res) => {
        try {
            const { rows } = await db.query(
                `SELECT
                    COUNT(*) FILTER (WHERE processed_at IS NULL AND dead_lettered_at IS NULL) AS pending,
                    COUNT(*) FILTER (WHERE dead_lettered_at IS NOT NULL) AS dead_lettered
                 FROM whatsapp_webhook_inbox`
            );
            res.json({ ok: true, pending: Number(rows[0].pending), deadLettered: Number(rows[0].dead_lettered) });
        } catch {
            res.status(503).json({ ok: false, reason: 'database_unavailable' });
        }
    });

    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        console.error('[http] unhandled error', error);
        res.status(500).json({ error: 'Internal server error' });
    };
    app.use(errorHandler);
    return app;
};
