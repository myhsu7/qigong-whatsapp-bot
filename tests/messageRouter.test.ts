import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCommand } from '../src/platform/whatsapp/messageRouter';

test('normalizes Traditional Chinese and English commands', () => {
    assert.equal(normalizeCommand(' 打卡 '), 'checkin');
    assert.equal(normalizeCommand('/checkin'), 'checkin');
    assert.equal(normalizeCommand('STATS'), 'stats');
    assert.equal(normalizeCommand('提醒開啟'), 'reminder-on');
    assert.equal(normalizeCommand('stop'), 'reminder-off');
    assert.equal(normalizeCommand('選單'), 'menu');
});

test('uses the menu for unsupported input', () => {
    assert.equal(normalizeCommand('今天練什麼'), 'unknown');
});
