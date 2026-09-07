import moment from 'moment-timezone';
import { db } from '../db';
import { Locale } from '../i18n';
import { calculateStreaks } from './stats';

export type AnalysisWindow = 30 | 90;
export type TrendDirection = 'up' | 'stable' | 'down';

export interface AnalysisSelection {
    leafId: number;
    leafCode: string;
    leafName: string;
    groupId: number;
    groupCode: string;
    groupName: string;
}

export interface AnalysisLog {
    id: number;
    date: string;
    hasPracticeNote: boolean;
    selections: AnalysisSelection[];
}

export interface MethodAnalysisItem {
    methodId: number;
    methodCode: string;
    methodName: string;
    matchedDays: number;
    attendanceRatio: number;
    compositionRatio: number;
}

export interface PracticeAnalysis {
    periodDays: AnalysisWindow;
    startDate: string;
    endDate: string;
    totalCheckinDays: number;
    missedDays: number;
    attendanceRate: number;
    currentStreak: number;
    longestStreak: number;
    journalDays: number;
    dataSufficient: boolean;
    trend: { firstHalfDays: number; secondHalfDays: number; delta: number; direction: TrendDirection };
    groupMethods: MethodAnalysisItem[];
    leafMethods: MethodAnalysisItem[];
}

export const parseAnalysisWindow = (value: unknown): AnalysisWindow | null => {
    const parsed = Number(value);
    return parsed === 30 || parsed === 90 ? parsed : null;
};

const buildItems = (
    counts: Map<number, { methodId: number; methodCode: string; methodName: string; dates: Set<string> }>,
    totalCheckinDays: number
) => {
    const values = [...counts.values()];
    const totalMatchedDays = values.reduce((sum, item) => sum + item.dates.size, 0);
    return values.map((item): MethodAnalysisItem => ({
        methodId: item.methodId,
        methodCode: item.methodCode,
        methodName: item.methodName,
        matchedDays: item.dates.size,
        attendanceRatio: totalCheckinDays ? item.dates.size / totalCheckinDays : 0,
        compositionRatio: totalMatchedDays ? item.dates.size / totalMatchedDays : 0
    })).sort((a, b) => b.matchedDays - a.matchedDays || a.methodName.localeCompare(b.methodName));
};

export const buildPracticeAnalysis = (
    periodDays: AnalysisWindow,
    startDate: string,
    endDate: string,
    logs: AnalysisLog[]
): PracticeAnalysis => {
    const uniqueLogs = [...new Map(logs.map((log) => [log.id, log])).values()];
    const dates = [...new Set(uniqueLogs.map((log) => log.date))].sort();
    const leafCounts = new Map<number, { methodId: number; methodCode: string; methodName: string; dates: Set<string> }>();
    const groupCounts = new Map<number, { methodId: number; methodCode: string; methodName: string; dates: Set<string> }>();
    for (const log of uniqueLogs) {
        for (const selection of log.selections) {
            const leaf = leafCounts.get(selection.leafId) || { methodId: selection.leafId, methodCode: selection.leafCode, methodName: selection.leafName, dates: new Set<string>() };
            leaf.dates.add(log.date);
            leafCounts.set(selection.leafId, leaf);
            const group = groupCounts.get(selection.groupId) || { methodId: selection.groupId, methodCode: selection.groupCode, methodName: selection.groupName, dates: new Set<string>() };
            group.dates.add(log.date);
            groupCounts.set(selection.groupId, group);
        }
    }
    const midpoint = moment.utc(startDate).add(periodDays / 2, 'days').format('YYYY-MM-DD');
    const firstHalfDays = dates.filter((date) => date < midpoint).length;
    const secondHalfDays = dates.length - firstHalfDays;
    const delta = secondHalfDays - firstHalfDays;
    const streaks = calculateStreaks(dates, endDate);
    return {
        periodDays,
        startDate,
        endDate,
        totalCheckinDays: dates.length,
        missedDays: periodDays - dates.length,
        attendanceRate: dates.length / periodDays,
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        journalDays: uniqueLogs.filter((log) => log.hasPracticeNote).length,
        dataSufficient: dates.length >= 5,
        trend: { firstHalfDays, secondHalfDays, delta, direction: delta >= 2 ? 'up' : delta <= -2 ? 'down' : 'stable' },
        groupMethods: buildItems(groupCounts, dates.length),
        leafMethods: buildItems(leafCounts, dates.length)
    };
};

const localizedName = (row: Record<string, any>, prefix: 'leaf' | 'group', locale: Locale) => {
    if (locale === 'en') return row[`${prefix}_name_en`] || row[`${prefix}_name_zh`];
    if (locale === 'zh_CN') return row[`${prefix}_name_zh_cn`] || row[`${prefix}_name_zh`];
    return row[`${prefix}_name_zh`];
};

export const getPracticeAnalysis = async (waId: string, periodDays: AnalysisWindow, locale: Locale): Promise<PracticeAnalysis> => {
    const user = await db.query('SELECT reminder_timezone FROM whatsapp_users WHERE wa_id = $1', [waId]);
    const timezone = user.rows[0]?.reminder_timezone || 'Asia/Taipei';
    const end = moment().tz(timezone).startOf('day');
    const start = end.clone().subtract(periodDays - 1, 'days');
    const { rows } = await db.query(
        `SELECT l.id, l.checkin_date::text, l.practice_note,
                leaf.id AS leaf_id, leaf.code AS leaf_code, leaf.name_zh AS leaf_name_zh,
                leaf.name_zh_cn AS leaf_name_zh_cn, leaf.name_en AS leaf_name_en,
                COALESCE(parent.id, leaf.id) AS group_id,
                COALESCE(parent.code, leaf.code) AS group_code,
                COALESCE(parent.name_zh, leaf.name_zh) AS group_name_zh,
                COALESCE(parent.name_zh_cn, leaf.name_zh_cn) AS group_name_zh_cn,
                COALESCE(parent.name_en, leaf.name_en) AS group_name_en
         FROM whatsapp_checkin_logs l
         LEFT JOIN whatsapp_checkin_method_selections selection ON selection.checkin_log_id = l.id
         LEFT JOIN practice_methods leaf ON leaf.id = selection.practice_method_id
         LEFT JOIN practice_methods parent ON parent.id = leaf.parent_id
         WHERE l.wa_id = $1 AND l.checkin_date >= $2 AND l.checkin_date <= $3
         ORDER BY l.checkin_date, l.id, leaf.sort_order, leaf.id`,
        [waId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
    );
    const logs = new Map<number, AnalysisLog>();
    for (const row of rows) {
        const id = Number(row.id);
        let log = logs.get(id);
        if (!log) {
            log = {
                id,
                date: row.checkin_date,
                hasPracticeNote: Boolean(row.practice_note?.trim()),
                selections: []
            };
        }
        if (row.leaf_id) log.selections.push({
            leafId: Number(row.leaf_id),
            leafCode: row.leaf_code,
            leafName: localizedName(row, 'leaf', locale),
            groupId: Number(row.group_id),
            groupCode: row.group_code,
            groupName: localizedName(row, 'group', locale)
        });
        logs.set(id, log);
    }
    return buildPracticeAnalysis(periodDays, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), [...logs.values()]);
};

export const buildRuleBasedCommentary = (analysis: PracticeAnalysis, locale: Locale) => {
    const top = analysis.groupMethods[0];
    if (!top || analysis.totalCheckinDays === 0) return locale === 'en'
        ? `There is not enough practice data in the last ${analysis.periodDays} days. Begin with a manageable routine and build it steadily.`
        : locale === 'zh_CN'
            ? `最近 ${analysis.periodDays} 天的练功资料还不足，先从容易维持的节奏开始，稳定累积即可。`
            : `最近 ${analysis.periodDays} 天的練功資料還不足，先從容易維持的節奏開始，穩定累積即可。`;
    const focused = top.compositionRatio >= 0.6;
    const trend = analysis.trend.direction === 'up' ? 'up' : analysis.trend.direction === 'down' ? 'down' : 'stable';
    if (locale === 'en') return `${focused ? `${top.methodName} is your clearest focus` : 'Your practice mix is balanced'}. Your recent frequency is ${trend === 'up' ? 'increasing' : trend === 'down' ? 'lower than earlier in the period' : 'steady'}. Keep the routine manageable and adjust gradually.`;
    if (locale === 'zh_CN') return `${focused ? `你近期以“${top.methodName}”为主要重心` : '你近期的功法配置较为均衡'}，练功频率${trend === 'up' ? '正逐步提升' : trend === 'down' ? '较前半段减少' : '大致稳定'}。建议维持容易持续的节奏，再逐步调整。`;
    return `${focused ? `你近期以「${top.methodName}」為主要重心` : '你近期的功法配置較為均衡'}，練功頻率${trend === 'up' ? '正逐步提升' : trend === 'down' ? '較前半段減少' : '大致穩定'}。建議維持容易持續的節奏，再逐步調整。`;
};
