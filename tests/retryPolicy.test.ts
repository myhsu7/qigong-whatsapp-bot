import assert from 'node:assert/strict';
import test from 'node:test';
import { maxWebhookAttempts, webhookRetryDelaySeconds } from '../src/jobs/retryPolicy';

test('applies capped exponential backoff to webhook retries', () => {
    assert.equal(webhookRetryDelaySeconds(1), 30);
    assert.equal(webhookRetryDelaySeconds(2), 60);
    assert.equal(webhookRetryDelaySeconds(8), 3600);
    assert.equal(webhookRetryDelaySeconds(maxWebhookAttempts), 3600);
});
