import moment from 'moment-timezone';
import { db } from '../db';

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

export const buildStatsMessage = (stats: UserStats) => stats.totalCheckins === 0
    ? '你目前還沒有打卡紀錄。輸入「打卡」開始今天的練功。'
    : [
        '你的練功統計',
        `目前連續打卡：${stats.currentStreak} 天`,
        `最長連續打卡：${stats.longestStreak} 天`,
        `總打卡天數：${stats.totalCheckins} 天`,
        `最近打卡日期：${stats.lastCheckinDate}`
    ].join('\n');
