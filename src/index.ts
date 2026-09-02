import { createApp } from './app';
import { env, missingRuntimeConfiguration } from './config/env';
import { pool } from './db';
import { processWebhookInbox } from './jobs/webhookWorker';
import { setupReminderJob } from './jobs/reminderJob';

const missing = missingRuntimeConfiguration();
if (missing.length && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
}
if (missing.length) console.warn(`[env] missing configuration: ${missing.join(', ')}`);

const app = createApp();
const server = app.listen(env.port, () => {
    console.log(`[whatsapp-bot] listening on port ${env.port}`);
    setupReminderJob();
    processWebhookInbox().catch((error) => console.error('[webhook-worker] startup failed', error));
});

const retryTimer = setInterval(() => {
    processWebhookInbox().catch((error) => console.error('[webhook-worker] retry failed', error));
}, 30000);
retryTimer.unref();

const shutdown = (signal: string) => {
    console.log(`[whatsapp-bot] received ${signal}, shutting down`);
    clearInterval(retryTimer);
    server.close(() => pool.end().finally(() => process.exit(0)));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
