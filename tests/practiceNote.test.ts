import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isAllowedPracticeNote, MAX_NOTE_LENGTH, mergeLegacyPracticeNotes, splitLegacyPracticeNote } from '../src/services/checkin';

test('combines every legacy note shape without losing its meaning', () => {
    assert.equal(mergeLegacyPracticeNotes('呼吸穩定', '肩頸放鬆'), '呼吸穩定\n肩頸放鬆');
    assert.equal(mergeLegacyPracticeNotes('呼吸穩定', ''), '呼吸穩定');
    assert.equal(mergeLegacyPracticeNotes('', '肩頸放鬆'), '肩頸放鬆');
    assert.equal(mergeLegacyPracticeNotes('  ', '\n'), '');
    assert.equal(MAX_NOTE_LENGTH, 1000);
    assert.deepEqual(splitLegacyPracticeNote(`${'a'.repeat(1000)}\n${'b'.repeat(1000)}`), ['a'.repeat(1000), 'b'.repeat(1000)]);
    assert.deepEqual(splitLegacyPracticeNote('short note'), ['short note', '']);
    assert.equal(isAllowedPracticeNote('a'.repeat(1000)), true);
    assert.equal(isAllowedPracticeNote(`${'a'.repeat(1000)}\n${'b'.repeat(1000)}`), true);
    assert.equal(isAllowedPracticeNote('a'.repeat(1001)), false);
});

test('ships idempotent WhatsApp practice-note migrations', () => {
    const migration = fs.readFileSync(path.join(process.cwd(), 'migrations/006_unified_practice_note.sql'), 'utf8');
    const backfill = fs.readFileSync(path.join(process.cwd(), 'migrations/007_backfill_unified_practice_note.sql'), 'utf8');
    assert.match(migration, /ALTER TABLE whatsapp_checkin_logs/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS practice_note TEXT/);
    assert.match(migration, /CREATE TRIGGER sync_whatsapp_practice_note_from_legacy/);
    assert.doesNotMatch(migration, /UPDATE whatsapp_checkin_logs/);
    assert.match(backfill, /WHERE practice_note IS NULL/);
    assert.match(backfill, /SET LOCAL statement_timeout = '0'/);
    assert.doesNotMatch(migration, /DROP COLUMN/);
});
