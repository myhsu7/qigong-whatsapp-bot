import moment from 'moment-timezone';
import { db } from '../db';
import { Locale, t } from '../i18n';

const TIMEZONE = 'Asia/Taipei';

export interface UserStats {
    totalCheckins: number;
    currentStreak: number;
    longestStreak: number;
    lastCheckinDate: string | null;
}

export const calculateStreaks = (dateStrings: string[], todayString: string): UserStats => {
    const uniqueDates = [...new Set(dateStrings)].sort();
    if (!uniqueDates.length) return { totalCheckins: 0, currentStreak: 0, longestStreak: 0, lastCheckinDate: null };
    const dates = uniqueDates.map((date) => moment.tz(date, 'YYYY-MM-DD', true, TIMEZONE));
    let longestStreak = 1;
    let running = 1;
    for (let index = 1; index < dates.length; index += 1) {
        running = dates[index].diff(dates[index - 1], 'days') === 1 ? running + 1 : 1;
        longestStreak = Math.max(longestStreak, running);
    }
    const today = moment.tz(todayString, 'YYYY-MM-DD', true, TIMEZONE);
    const last = dates.at(-1)!;
    let currentStreak = 0;
    if (last.diff(today, 'days') === 0 || last.diff(today, 'days') === -1) {
        currentStreak = 1;
        for (let index = dates.length - 1; index > 0 && dates[index].diff(dates[index - 1], 'days') === 1; index -= 1) {
            currentStreak += 1;
        }
    }
    return { totalCheckins: dates.length, currentStreak, longestStreak, lastCheckinDate: uniqueDates.at(-1)! };
};

export const getUserStats = async (waId: string): Promise<UserStats> => {
    const { rows } = await db.query(
        `SELECT l.checkin_date::text, u.reminder_timezone
         FROM whatsapp_users u
         LEFT JOIN whatsapp_checkin_logs l ON l.wa_id = u.wa_id
         WHERE u.wa_id = $1 ORDER BY l.checkin_date`,
        [waId]
    );
    const timezone = rows[0]?.reminder_timezone || TIMEZONE;
    return calculateStreaks(rows.map((row) => row.checkin_date).filter(Boolean), moment().tz(timezone).format('YYYY-MM-DD'));
};

export const buildStatsMessage = (stats: UserStats, locale: Locale = 'zh_TW') => stats.totalCheckins === 0
    ? t(locale).statsEmpty
    : t(locale).stats(stats.currentStreak, stats.longestStreak, stats.totalCheckins, stats.lastCheckinDate!);
