import assert from 'node:assert/strict';
import test from 'node:test';

test('validates Meta credentials without exposing credential values', async () => {
    process.env.META_APP_SECRET = 'app-secret';
    process.env.META_VERIFY_TOKEN = 'verify-token';
    process.env.META_ACCESS_TOKEN = 'access-token';
    process.env.META_PHONE_NUMBER_ID = '123456';
    process.env.PUBLIC_BASE_URL = 'https://example.com';

    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = async () => new Response(JSON.stringify({ id: '123456' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
        const { checkMetaCredentials } = await import('../src/services/metaHealth');
        assert.deepEqual(await checkMetaCredentials(true), {
            ok: true,
            checkedAt: (await checkMetaCredentials()).checkedAt
        });

        globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 190 } }), {
            status: 401,
            headers: { 'content-type': 'application/json' }
        });
        const rejected = await checkMetaCredentials(true);
        assert.equal(rejected.ok, false);
        assert.equal(rejected.reason, 'credentials_rejected');
        assert.equal(rejected.errorCode, 190);
        assert.equal(JSON.stringify(rejected).includes('access-token'), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
