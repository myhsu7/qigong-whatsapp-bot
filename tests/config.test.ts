import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWhatsAppChatUrl } from '../src/config/env';

test('builds WhatsApp chat URLs only from E.164 digits', () => {
    assert.equal(buildWhatsAppChatUrl('15551234567'), 'https://wa.me/15551234567');
    assert.equal(buildWhatsAppChatUrl('+1 555 123 4567'), null);
    assert.equal(buildWhatsAppChatUrl('0123456789'), null);
    assert.equal(buildWhatsAppChatUrl('1234567'), null);
    assert.equal(buildWhatsAppChatUrl('1'.repeat(16)), null);
});
