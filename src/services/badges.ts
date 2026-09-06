import moment from 'moment-timezone';
import { Lunar } from 'lunar-javascript';
import { db } from '../db';
import { Locale, localizeBadge } from '../i18n';
import { calculateStreaks } from './stats';
import { getPracticeMethodRows } from './taxonomy';
import { getSanFuPeriod } from '../utils/sanfu';

const SEASONAL_TIMEZONE = 'Asia/Taipei';
const METHOD_GROUPS = ['dayan', 'wuqinxi', 'huichun', 'guishou', 'zhengyang', 'huanghai', 'lotus', 'heqi', 'sanwo', 'liuyin', 'jinggong'] as const;
const COMBO_GROUPS = ['dayan', 'wuqinxi', 'huichun', 'guishou', 'zhengyang', 'jinggong'] as const;
const METHOD_THRESHOLDS = [7, 30, 100] as const;

export interface BadgeLog {
    id: number;
    date: string;
    createdAt: string | Date;
    checkinTimezone?: string;
    checkinTimezoneInferred?: boolean;
    methodCodes: string[];
    groupCodes: string[];
}

export interface BadgeCandidate {
    badgeId: string;
    earnedYear: number;
    triggerCheckinLogId?: number;
}

export interface UserBadge {
    id: string;
    name: string;
    emoji: string;
    description: string;
    category: string;
    earnedYear: number;
    unlockedAt: string;
}

const winterSolstice = (year: number) => {
    const value = Lunar.fromDate(new Date(year, 6, 1)).getJieQiTable().DONG_ZHI;
    return value ? moment.tz(value.toYmd(), 'YYYY-MM-DD', true, SEASONAL_TIMEZONE) : null;
};

const findStreakTrigger = (logs: BadgeLog[], threshold: number) => {
    let running = 0;
    for (let index = 0; index < logs.length; index += 1) {
        running = index > 0 && moment.utc(logs[index].date, 'YYYY-MM-DD', true).diff(moment.utc(logs[index - 1].date, 'YYYY-MM-DD', true), 'days') === 1 ? running + 1 : 1;
        if (running >= threshold) return logs[index].id;
    }
    return undefined;
};

const findConsecutiveTimeWindow = (logs: BadgeLog[], timezone: string, startHour: number, endHour: number) => {
    const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    for (let start = 0; start <= ordered.length - 5; start += 1) {
        const window = ordered.slice(start, start + 5);
        const consecutive = window.every((log, index) => index === 0
            || moment(log.date, 'YYYY-MM-DD', true).diff(moment(window[index - 1].date, 'YYYY-MM-DD', true), 'days') === 1);
        if (consecutive && window.every((log) => {
            if (log.checkinTimezoneInferred) return false;
            const hour = moment(log.createdAt).tz(log.checkinTimezone || timezone).hour();
            return hour >= startHour && hour < endHour;
        })) return window.at(-1)!.id;
    }
    return undefined;
};

export const determineBadgeCandidates = (
    logs: BadgeLog[],
    timezone: string,
    requiredLeavesByGroup: Map<string, string[]>,
    now = moment.tz(SEASONAL_TIMEZONE)
): BadgeCandidate[] => {
    if (!logs.length) return [];
    const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    const latestId = ordered.at(-1)!.id;
    const stats = calculateStreaks(ordered.map((log) => log.date), now.clone().tz(timezone).format('YYYY-MM-DD'));
    const candidates = new Map<string, BadgeCandidate>();
    const add = (badgeId: string, earnedYear = 0, triggerCheckinLogId = latestId) => {
        const key = `${badgeId}:${earnedYear}`;
        if (!candidates.has(key)) candidates.set(key, { badgeId, earnedYear, triggerCheckinLogId });
    };

    for (const threshold of [3, 7, 21, 100]) {
        if (stats.longestStreak >= threshold) add(`streak_${threshold}`, 0, findStreakTrigger(ordered, threshold));
    }
    for (const threshold of [10, 100]) {
        if (stats.totalCheckins >= threshold) add(`total_${threshold}`, 0, ordered[threshold - 1].id);
    }
    const morningTrigger = findConsecutiveTimeWindow(ordered, timezone, 5, 7);
    const nightTrigger = findConsecutiveTimeWindow(ordered, timezone, 21, 23);
    if (morningTrigger) add('time_morning', 0, morningTrigger);
    if (nightTrigger) add('time_night', 0, nightTrigger);

    const years = new Set<number>();
    for (const log of ordered) {
        const year = Number(log.date.slice(0, 4));
        years.add(year);
        years.add(year - 1);
    }
    for (const year of [...years].filter((value) => value >= 2000 && value <= now.year()).sort()) {
        const sanfu = getSanFuPeriod(year);
        if (sanfu && now.isSameOrAfter(sanfu.end, 'day')) {
            const dates = new Set(ordered.filter((log) => log.date >= sanfu.start.format('YYYY-MM-DD') && log.date <= sanfu.end.format('YYYY-MM-DD')).map((log) => log.date));
            if (dates.size >= sanfu.totalDays) add('seasonal_summer_27', year, ordered.find((log) => log.date === sanfu.end.format('YYYY-MM-DD'))?.id);
        }
        const solstice = winterSolstice(year);
        if (solstice) {
            const winterEnd = solstice.clone().add(26, 'days');
            if (now.isSameOrAfter(winterEnd, 'day')) {
                const qualifying = new Set(ordered.filter((log) =>
                    log.date >= solstice.format('YYYY-MM-DD')
                    && log.date <= winterEnd.format('YYYY-MM-DD')
                    && log.groupCodes.includes('guishou')
                ).map((log) => log.date));
                if (qualifying.size === 27) add('seasonal_winter_27', year, ordered.find((log) => log.date === winterEnd.format('YYYY-MM-DD'))?.id);
            }
        }
    }

    for (const log of ordered) {
        const selected = new Set(log.methodCodes);
        for (const group of COMBO_GROUPS) {
            const required = requiredLeavesByGroup.get(group) || [];
            if (required.length && required.every((code) => selected.has(code))) add(`combo_${group}`, Number(log.date.slice(0, 4)), log.id);
        }
    }

    for (const group of METHOD_GROUPS) {
        const practicedLogs = ordered.filter((log) => log.groupCodes.includes(group));
        const practicedDays = new Set(practicedLogs.map((log) => log.date)).size;
        for (const threshold of METHOD_THRESHOLDS) {
            if (practicedDays >= threshold) add(`method_${group}_${threshold}`, 0, practicedLogs[threshold - 1].id);
        }
    }
    return [...candidates.values()];
};

const getBadgeContext = async (waId: string) => {
    const [user, logsResult, methods] = await Promise.all([
        db.query('SELECT reminder_timezone FROM whatsapp_users WHERE wa_id = $1', [waId]),
        db.query(
            `SELECT l.id, l.checkin_date::text, l.created_at, l.checkin_timezone, l.checkin_timezone_inferred,
                    COALESCE(ARRAY_AGG(DISTINCT m.code) FILTER (WHERE m.code IS NOT NULL), '{}') AS method_codes,
                    COALESCE(ARRAY_AGG(DISTINCT COALESCE(parent.code, m.code)) FILTER (WHERE m.code IS NOT NULL), '{}') AS group_codes
             FROM whatsapp_checkin_logs l
             LEFT JOIN whatsapp_checkin_method_selections s ON s.checkin_log_id = l.id
             LEFT JOIN practice_methods m ON m.id = s.practice_method_id
             LEFT JOIN practice_methods parent ON parent.id = m.parent_id
             WHERE l.wa_id = $1 GROUP BY l.id ORDER BY l.checkin_date`,
            [waId]
        ),
        getPracticeMethodRows()
    ]);
    const codeById = new Map(methods.map((method) => [method.id, method.code]));
    const requiredLeaves = new Map<string, string[]>();
    for (const method of methods.filter((row) => row.methodType === 'leaf' && row.parentId)) {
        const parentCode = codeById.get(method.parentId!);
        if (parentCode) requiredLeaves.set(parentCode, [...(requiredLeaves.get(parentCode) || []), method.code]);
    }
    const logs: BadgeLog[] = logsResult.rows.map((row) => ({
        id: Number(row.id),
        date: row.checkin_date,
        createdAt: row.created_at,
        checkinTimezone: row.checkin_timezone,
        checkinTimezoneInferred: row.checkin_timezone_inferred,
        methodCodes: row.method_codes || [],
        groupCodes: row.group_codes || []
    }));
    return { timezone: user.rows[0]?.reminder_timezone || SEASONAL_TIMEZONE, logs, requiredLeaves };
};

export const evaluateBadges = async (waId: string, locale: Locale = 'zh_TW') => {
    const { timezone, logs, requiredLeaves } = await getBadgeContext(waId);
    const candidates = determineBadgeCandidates(logs, timezone, requiredLeaves);
    if (!candidates.length) return [];
    const { rows } = await db.query(
        `WITH candidates AS (
             SELECT * FROM UNNEST($2::varchar[], $3::integer[], $4::bigint[])
                 AS candidate(badge_id, earned_year, trigger_checkin_log_id)
         ), inserted AS (
             INSERT INTO whatsapp_user_badges (wa_id, badge_id, earned_year, trigger_checkin_log_id)
             SELECT $1, badge_id, earned_year, trigger_checkin_log_id FROM candidates
             ON CONFLICT DO NOTHING RETURNING badge_id, earned_year, unlocked_at
         )
         SELECT b.id, b.name, b.emoji, b.description, b.category, i.earned_year, i.unlocked_at
         FROM inserted i JOIN whatsapp_badges b ON b.id = i.badge_id ORDER BY b.id`,
        [
            waId,
            candidates.map((candidate) => candidate.badgeId),
            candidates.map((candidate) => candidate.earnedYear),
            candidates.map((candidate) => candidate.triggerCheckinLogId || null)
        ]
    );
    return rows.map((row) => localizeBadge({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        description: row.description,
        category: row.category,
        earnedYear: Number(row.earned_year),
        unlockedAt: row.unlocked_at
    }, locale));
};

export const getUserBadges = async (waId: string, locale: Locale = 'zh_TW'): Promise<UserBadge[]> => {
    const { rows } = await db.query(
        `SELECT b.id, b.name, b.emoji, b.description, b.category, ub.earned_year, ub.unlocked_at
         FROM whatsapp_user_badges ub JOIN whatsapp_badges b ON b.id = ub.badge_id
         WHERE ub.wa_id = $1 ORDER BY ub.unlocked_at, b.id`,
        [waId]
    );
    return rows.map((row) => localizeBadge({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        description: row.description,
        category: row.category,
        earnedYear: Number(row.earned_year),
        unlockedAt: row.unlocked_at
    }, locale));
};

export const reconcileBadgesSince = async (since: Date | null) => {
    const { rows } = await db.query(
        `SELECT DISTINCT wa_id FROM whatsapp_checkin_logs
         WHERE $1::timestamptz IS NULL OR updated_at > $1 ORDER BY wa_id`,
        [since]
    );
    let awarded = 0;
    for (const row of rows) awarded += (await evaluateBadges(row.wa_id)).length;
    return { users: rows.length, awarded };
};
