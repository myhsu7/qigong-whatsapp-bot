import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { env } from '../src/config/env';
import webappRoutes from '../src/routes/webapp';

test('redirects the fixed return route to the configured WhatsApp chat', async () => {
    const originalNumber = env.whatsappBusinessNumber;
    const app = express();
    app.use('/whatsapp/webapp', webappRoutes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert(address && typeof address === 'object');
    const url = `http://127.0.0.1:${address.port}/whatsapp/webapp/return`;
    try {
        env.whatsappBusinessNumber = '15551234567';
        const response = await fetch(url, { redirect: 'manual' });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), 'https://wa.me/15551234567');
        assert.match(response.headers.get('cache-control') || '', /no-store/);

        env.whatsappBusinessNumber = '0123456789';
        const unavailable = await fetch(url, { redirect: 'manual' });
        assert.equal(unavailable.status, 503);
    } finally {
        env.whatsappBusinessNumber = originalNumber;
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
});
