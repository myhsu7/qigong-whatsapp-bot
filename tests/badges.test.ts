import assert from 'node:assert/strict';
import test from 'node:test';
import moment from 'moment-timezone';
import { BadgeLog, determineBadgeCandidates } from '../src/services/badges';
import { getSanFuPeriod } from '../src/utils/sanfu';
import { localizeBadge } from '../src/i18n';

const makeLogs = (count: number, codes = ['dayan_chu', 'dayan_gao']): BadgeLog[] => Array.from({ length: count }, (_, index) => {
    const date = moment.tz('2026-01-01', 'Asia/Taipei').add(index, 'day');
    return {
        id: index + 1,
        date: date.format('YYYY-MM-DD'),
        createdAt: `${date.format('YYYY-MM-DD')}T05:30:00+08:00`,
        checkinTimezone: 'Asia/Taipei',
        methodCodes: codes,
        groupCodes: ['dayan']
    };
});

test('awards historical streak, time, method and annual combo candidates', () => {
    const required = new Map([['dayan', ['dayan_chu', 'dayan_gao']]]);
    const candidates = determineBadgeCandidates(makeLogs(7), 'Asia/Taipei', required, moment.tz('2026-02-01', 'Asia/Taipei'));
    const keys = new Set(candidates.map((candidate) => `${candidate.badgeId}:${candidate.earnedYear}`));
    assert.ok(keys.has('streak_3:0'));
    assert.ok(keys.has('streak_7:0'));
    assert.ok(keys.has('time_morning:0'));
    assert.ok(keys.has('method_dayan_7:0'));
    assert.ok(keys.has('combo_dayan:2026'));
    assert.equal(keys.has('total_10:0'), false);
    assert.equal(candidates.find((item) => item.badgeId === 'streak_3')?.triggerCheckinLogId, 3);
    assert.equal(candidates.find((item) => item.badgeId === 'time_morning')?.triggerCheckinLogId, 5);
    assert.equal(candidates.find((item) => item.badgeId === 'method_dayan_7')?.triggerCheckinLogId, 7);
});

test('uses the timezone captured at check-in for time badges', () => {
    const candidates = determineBadgeCandidates(makeLogs(5), 'America/Los_Angeles', new Map(), moment.tz('2026-02-01', 'Asia/Taipei'));
    assert.ok(candidates.some((item) => item.badgeId === 'time_morning'));
    const inferred = makeLogs(5).map((log) => ({ ...log, checkinTimezoneInferred: true }));
    assert.equal(determineBadgeCandidates(inferred, 'Asia/Taipei', new Map()).some((item) => item.badgeId === 'time_morning'), false);
});

test('requires every active leaf for a combo badge', () => {
    const required = new Map([['jinggong', ['jinggong_zhoutian', 'jinggong_qixing', 'jinggong_songjing']]]);
    const partial = makeLogs(1, ['jinggong_zhoutian', 'jinggong_qixing']).map((log) => ({ ...log, groupCodes: ['jinggong'] }));
    assert.equal(determineBadgeCandidates(partial, 'Asia/Taipei', required).some((item) => item.badgeId === 'combo_jinggong'), false);
    partial[0].methodCodes.push('jinggong_songjing');
    assert.equal(determineBadgeCandidates(partial, 'Asia/Taipei', required).some((item) => item.badgeId === 'combo_jinggong'), true);
});

test('calculates the complete 2026 Sanfu period', () => {
    const period = getSanFuPeriod(2026)!;
    assert.equal(period.start.format('YYYY-MM-DD'), '2026-07-15');
    assert.equal(period.end.format('YYYY-MM-DD'), '2026-08-23');
    assert.equal(period.totalDays, 40);
});

test('backfills completed seasonal achievements after their windows close', () => {
    const sanfu = getSanFuPeriod(2026)!;
    const summerLogs: BadgeLog[] = Array.from({ length: sanfu.totalDays }, (_, index) => {
        const date = sanfu.start.clone().add(index, 'day').format('YYYY-MM-DD');
        return { id: index + 1, date, createdAt: `${date}T08:00:00+08:00`, methodCodes: [], groupCodes: [] };
    });
    const summer = determineBadgeCandidates(summerLogs, 'Asia/Taipei', new Map(), moment.tz('2026-09-01', 'Asia/Taipei'));
    assert.ok(summer.some((item) => item.badgeId === 'seasonal_summer_27' && item.earnedYear === 2026));

    const winterLogs: BadgeLog[] = Array.from({ length: 27 }, (_, index) => {
        const date = moment.tz('2025-12-21', 'Asia/Taipei').add(index, 'day').format('YYYY-MM-DD');
        return { id: 100 + index, date, createdAt: `${date}T08:00:00+08:00`, methodCodes: ['guishou_bagua'], groupCodes: ['guishou'] };
    });
    const winter = determineBadgeCandidates(winterLogs, 'Asia/Taipei', new Map(), moment.tz('2026-02-01', 'Asia/Taipei'));
    assert.ok(winter.some((item) => item.badgeId === 'seasonal_winter_27' && item.earnedYear === 2025));
});

test('localizes fixed, method and combo badges', () => {
    const badge = { id: 'streak_3', name: '入門', description: '連續打卡 3 天' };
    assert.equal(localizeBadge(badge, 'en').name, 'First Steps');
    assert.match(localizeBadge({ ...badge, id: 'method_guishou_7' }, 'zh_CN').description, /龟寿功/);
    assert.match(localizeBadge({ ...badge, id: 'combo_jinggong' }, 'en').name, /Complete Set/);
});
