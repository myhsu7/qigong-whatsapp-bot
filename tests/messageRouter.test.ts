import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCommand } from '../src/platform/whatsapp/messageRouter';
import { detectLocaleFromText, localeFromSelection } from '../src/services/language';

test('normalizes Traditional Chinese and English commands', () => {
    assert.equal(normalizeCommand(' 打卡 '), 'checkin');
    assert.equal(normalizeCommand('/checkin'), 'checkin');
    assert.equal(normalizeCommand('STATS'), 'stats');
    assert.equal(normalizeCommand('统计'), 'stats');
    assert.equal(normalizeCommand('提醒開啟'), 'reminder-on');
    assert.equal(normalizeCommand('提醒关闭'), 'reminder-off');
    assert.equal(normalizeCommand('stop'), 'reminder-off');
    assert.equal(normalizeCommand('選單'), 'menu');
    assert.equal(normalizeCommand('language'), 'language');
});

test('detects locale from explicit choices and distinctive text', () => {
    assert.equal(localeFromSelection('繁體中文'), 'zh_TW');
    assert.equal(localeFromSelection('简体中文'), 'zh_CN');
    assert.equal(localeFromSelection('English'), 'en');
    assert.equal(detectLocaleFromText('查看统计'), 'zh_CN');
    assert.equal(detectLocaleFromText('查看統計'), 'zh_TW');
    assert.equal(detectLocaleFromText('hello'), 'en');
    assert.equal(detectLocaleFromText('打卡'), null);
});

test('uses the menu for unsupported input', () => {
    assert.equal(normalizeCommand('今天練什麼'), 'unknown');
});
