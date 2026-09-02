import express, { ErrorRequestHandler } from 'express';
import path from 'path';
import { receiveWebhook, verifyWebhook } from './platform/whatsapp/webhook';
import webappRoutes from './routes/webapp';
import apiRoutes from './routes/api';
import { db } from './db';
import { missingRuntimeConfiguration } from './config/env';

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

    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
        console.error('[http] unhandled error', error);
        res.status(500).json({ error: 'Internal server error' });
    };
    app.use(errorHandler);
    return app;
};
