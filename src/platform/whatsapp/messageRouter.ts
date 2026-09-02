import { issueMagicLink } from '../../services/session';
import { buildStatsMessage, getUserStats } from '../../services/stats';
import { getReminderSettings, updateReminderSettings } from '../../services/reminders';
import { sendText } from './client';
import { env } from '../../config/env';

export type Command = 'menu' | 'checkin' | 'stats' | 'reminder' | 'reminder-on' | 'reminder-off' | 'unknown';

export const normalizeCommand = (input: string): Command => {
    const value = input.trim().toLowerCase().replace(/^\//, '');
    if (['開始', '選單', 'menu', 'start', 'help', '說明'].includes(value)) return 'menu';
    if (['打卡', 'checkin'].includes(value)) return 'checkin';
    if (['統計', 'stats'].includes(value)) return 'stats';
    if (['提醒', 'reminder'].includes(value)) return 'reminder';
    if (['提醒開啟', '開啟提醒', 'reminder on'].includes(value)) return 'reminder-on';
    if (['提醒關閉', '關閉提醒', 'reminder off', '停止', 'stop'].includes(value)) return 'reminder-off';
    return 'unknown';
};

const menu = [
    '氣功打卡小幫手',
    '',
    '輸入「打卡」：記錄今日練功',
    '輸入「統計」：查看連續與累計天數',
    '輸入「提醒」：管理每日提醒',
    '輸入「選單」：再次顯示本說明'
].join('\n');

export const routeInboundMessage = async (waId: string, text: string, messageId: string) => {
    const responseKey = `inbound:${messageId}:response`;
    switch (normalizeCommand(text)) {
        case 'checkin': {
            const link = await issueMagicLink(waId);
            return sendText(waId, `請使用這個一次性連結完成今日打卡（${env.magicLinkTtlMinutes} 分鐘內有效）：\n${link}`, responseKey);
        }
        case 'stats':
            return sendText(waId, buildStatsMessage(await getUserStats(waId)), responseKey);
        case 'reminder': {
            const settings = await getReminderSettings(waId);
            return sendText(waId, [
                `每日提醒目前：${settings.reminderEnabled ? '開啟' : '關閉'}`,
                `提醒時間：${settings.reminderHour}:00（${settings.reminderTimezone}）`,
                '',
                '輸入「提醒開啟」或「提醒關閉」。時間與時區可在打卡頁設定。'
            ].join('\n'), responseKey);
        }
        case 'reminder-on':
            await updateReminderSettings(waId, { reminderEnabled: true });
            return sendText(waId, '每日打卡提醒已開啟。你可以隨時輸入「提醒關閉」取消。', responseKey);
        case 'reminder-off':
            await updateReminderSettings(waId, { reminderEnabled: false });
            return sendText(waId, '每日打卡提醒已關閉。', responseKey);
        case 'menu':
        case 'unknown':
            return sendText(waId, menu, responseKey);
    }
};
