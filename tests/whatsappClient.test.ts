import assert from 'node:assert/strict';
import test from 'node:test';

test('blocks closed-window free-form sends before calling Meta', async () => {
    process.env.META_ACCESS_TOKEN = 'test-token';
    process.env.META_PHONE_NUMBER_ID = 'test-phone';
    const { db } = await import('../src/db');
    const { FreeformWindowClosedError, sendText } = await import('../src/platform/whatsapp/client');
    const originalQuery = db.query;
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    try {
        (db as any).query = async (sql: string) => {
            assert.match(sql, /last_inbound_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'/);
            return { rowCount: 1, rows: [{ open: false }] };
        };
        globalThis.fetch = async () => {
            fetchCalls += 1;
            return new Response('{}');
        };
        await assert.rejects(sendText('15550000000', 'test'), FreeformWindowClosedError);
        assert.equal(fetchCalls, 0);
    } finally {
        (db as any).query = originalQuery;
        globalThis.fetch = originalFetch;
    }
});

test('returns completed idempotent sends without reopening the service window', async () => {
    process.env.META_ACCESS_TOKEN = 'test-token';
    process.env.META_PHONE_NUMBER_ID = 'test-phone';
    const { db } = await import('../src/db');
    const { sendText } = await import('../src/platform/whatsapp/client');
    const originalQuery = db.query;
    const originalFetch = globalThis.fetch;
    let queryCalls = 0;
    try {
        (db as any).query = async (sql: string) => {
            queryCalls += 1;
            assert.match(sql, /FROM whatsapp_outbound_messages/);
            return { rowCount: 1, rows: [{ meta_message_id: 'wamid.existing', failed_at: null }] };
        };
        globalThis.fetch = async () => { throw new Error('Meta must not be called'); };
        assert.equal(await sendText('15550000000', 'test', 'existing-key'), 'wamid.existing');
        assert.equal(queryCalls, 1);
    } finally {
        (db as any).query = originalQuery;
        globalThis.fetch = originalFetch;
    }
});

test('allows templates outside the customer-service window', async () => {
    process.env.META_ACCESS_TOKEN = 'test-token';
    process.env.META_PHONE_NUMBER_ID = 'test-phone';
    const { db } = await import('../src/db');
    const { sendTemplate } = await import('../src/platform/whatsapp/client');
    const originalQuery = db.query;
    const originalFetch = globalThis.fetch;
    const statements: string[] = [];
    try {
        (db as any).query = async (sql: string) => {
            statements.push(sql);
            if (sql.includes('INSERT INTO')) return { rowCount: 1, rows: [{ id: 7 }] };
            return { rowCount: 1, rows: [] };
        };
        globalThis.fetch = async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.template' }] }), { status: 200 });
        assert.equal(await sendTemplate('15550000000', 'daily_reminder', 'en'), 'wamid.template');
        assert.equal(statements.some((sql) => sql.includes('last_inbound_at')), false);
    } finally {
        (db as any).query = originalQuery;
        globalThis.fetch = originalFetch;
    }
});
