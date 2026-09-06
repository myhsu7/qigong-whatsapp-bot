import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import apiRoutes from '../src/routes/api';
import { db } from '../src/db';

test('protects analysis APIs, validates windows, and disables response caching', async () => {
    const originalQuery = db.query;
    const app = express();
    app.use(express.json());
    app.use('/whatsapp/api/webapp', apiRoutes);
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: error instanceof Error ? error.message : 'error' });
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/whatsapp/api/webapp`;
    try {
        (db as any).query = async (sql: string) => {
            if (sql.includes('FROM whatsapp_web_sessions')) return { rows: [{ wa_id: '15550000000' }], rowCount: 1 };
            if (sql.includes('language_code')) return { rows: [{ language_code: 'en', language_selected: true }], rowCount: 1 };
            if (sql.includes('reminder_timezone')) return { rows: [{ reminder_timezone: 'Asia/Taipei' }], rowCount: 1 };
            if (sql.includes('FROM whatsapp_checkin_logs')) return { rows: [], rowCount: 0 };
            throw new Error(`Unexpected query: ${sql}`);
        };
        const unauthenticated = await fetch(`${baseUrl}/analysis?window=30`);
        assert.equal(unauthenticated.status, 401);

        const headers = { cookie: 'qigong_wa_session=test-session' };
        const invalid = await fetch(`${baseUrl}/analysis?window=60`, { headers });
        assert.equal(invalid.status, 400);

        const analysis = await fetch(`${baseUrl}/analysis?window=30`, { headers });
        assert.equal(analysis.status, 200);
        assert.match(analysis.headers.get('cache-control') || '', /private, no-store/);
        assert.equal((await analysis.json() as { periodDays: number }).periodDays, 30);

        const wrongOrigin = await fetch(`${baseUrl}/analysis/commentary`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({ window: 30 })
        });
        assert.equal(wrongOrigin.status, 403);

        const commentary = await fetch(`${baseUrl}/analysis/commentary`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json', 'x-requested-with': 'qigong-webapp' },
            body: JSON.stringify({ window: 30 })
        });
        assert.equal(commentary.status, 200);
        assert.match(commentary.headers.get('cache-control') || '', /private, no-store/);
        assert.equal((await commentary.json() as { source: string }).source, 'fallback');
    } finally {
        (db as any).query = originalQuery;
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});
