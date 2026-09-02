import assert from 'node:assert/strict';
import test from 'node:test';
import { computeMetaSignature, verifyMetaSignature } from '../src/platform/whatsapp/signature';

test('verifies a valid Meta webhook signature', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = computeMetaSignature(body, 'test-secret');
    assert.equal(verifyMetaSignature(body, signature, 'test-secret'), true);
});

test('rejects changed bodies and missing configuration', () => {
    const signature = computeMetaSignature(Buffer.from('original'), 'test-secret');
    assert.equal(verifyMetaSignature(Buffer.from('changed'), signature, 'test-secret'), false);
    assert.equal(verifyMetaSignature(Buffer.from('original'), undefined, 'test-secret'), false);
    assert.equal(verifyMetaSignature(Buffer.from('original'), signature, ''), false);
});
