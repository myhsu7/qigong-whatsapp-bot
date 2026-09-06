import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWhatsAppTimestamp } from '../src/jobs/webhookWorker';
import { upsertWhatsAppUser } from '../src/services/checkin';
import { db } from '../src/db';

test('accepts Meta message timestamps without substituting processing time', () => {
    assert.equal(parseWhatsAppTimestamp('1788700000'), 1788700000);
    assert.equal(parseWhatsAppTimestamp(1788700000), 1788700000);
    assert.equal(parseWhatsAppTimestamp(''), undefined);
    assert.equal(parseWhatsAppTimestamp('not-a-timestamp'), undefined);
    assert.equal(parseWhatsAppTimestamp('1788700000000'), undefined);
});

test('persists the latest event timestamp rather than webhook processing time', async () => {
    const originalQuery = db.query;
    try {
        (db as any).query = async (sql: string, values: unknown[]) => {
            assert.match(sql, /to_timestamp\(\$3\)/);
            assert.match(sql, /GREATEST/);
            assert.deepEqual(values, ['15550000000', 'Practitioner', 1788700000]);
            return { rows: [], rowCount: 1 };
        };
        await upsertWhatsAppUser('15550000000', 'Practitioner', 1788700000);
    } finally {
        (db as any).query = originalQuery;
    }
});
