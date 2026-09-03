import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStatsMessage, calculateStreaks } from '../src/services/stats';

test('calculates current and longest streaks', () => {
    assert.deepEqual(calculateStreaks(
        ['2026-08-25', '2026-08-26', '2026-09-01', '2026-09-02'],
        '2026-09-03'
    ), {
        totalCheckins: 4,
        currentStreak: 2,
        longestStreak: 2,
        lastCheckinDate: '2026-09-02'
    });
});

test('keeps a streak active after a check-in today', () => {
    const stats = calculateStreaks(['2026-09-01', '2026-09-02', '2026-09-03'], '2026-09-03');
    assert.equal(stats.currentStreak, 3);
    assert.equal(stats.longestStreak, 3);
});

test('returns zero current streak for stale records and deduplicates dates', () => {
    const stats = calculateStreaks(['2026-08-01', '2026-08-01', '2026-08-02'], '2026-09-03');
    assert.equal(stats.totalCheckins, 2);
    assert.equal(stats.currentStreak, 0);
    assert.equal(stats.longestStreak, 2);
});

test('renders statistics in all supported languages', () => {
    const stats = { totalCheckins: 3, currentStreak: 2, longestStreak: 3, lastCheckinDate: '2026-09-03' };
    assert.match(buildStatsMessage(stats, 'zh_TW'), /目前連續打卡：2 天/);
    assert.match(buildStatsMessage(stats, 'zh_CN'), /目前连续打卡：2 天/);
    assert.match(buildStatsMessage(stats, 'en'), /Current streak: 2 days/);
});
