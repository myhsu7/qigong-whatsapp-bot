export const supportedLocales = ['zh_TW', 'zh_CN', 'en'] as const;
export type Locale = typeof supportedLocales[number];

export const normalizeLocale = (value: unknown): Locale =>
    supportedLocales.includes(value as Locale) ? value as Locale : 'zh_TW';

const messages = {
    zh_TW: {
        languagePrompt: '請選擇語言 / 请选择语言 / Choose your language:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: '語言已設為繁體中文。',
        menu: '氣功打卡小幫手\n\n輸入「打卡」：記錄今日練功\n輸入「統計」：查看連續與累計天數\n輸入「提醒」：管理每日提醒\n輸入「語言」：切換介面語言\n輸入「選單」：再次顯示本說明',
        checkinLink: (minutes: number, link: string) => `請使用這個一次性連結完成今日打卡（${minutes} 分鐘內有效）：\n${link}`,
        statsEmpty: '你目前還沒有打卡紀錄。輸入「打卡」開始今天的練功。',
        stats: (current: number, longest: number, total: number, last: string) => `你的練功統計\n目前連續打卡：${current} 天\n最長連續打卡：${longest} 天\n總打卡天數：${total} 天\n最近打卡日期：${last}`,
        enabled: '開啟', disabled: '關閉',
        reminderStatus: (status: string, hour: number, timezone: string) => `每日提醒目前：${status}\n提醒時間：${hour}:00（${timezone}）\n\n輸入「提醒開啟」或「提醒關閉」。時間與時區可在打卡頁設定。`,
        reminderOn: '每日打卡提醒已開啟。你可以隨時輸入「提醒關閉」取消。',
        reminderOff: '每日打卡提醒已關閉。',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? '今日打卡已更新。' : '今日打卡完成。'}\n功法：${methods.join('、')}\n目前連續：${current} 天｜累計：${total} 天`,
        selectMethod: '請至少選擇一個功法', maxLength: '文字欄位不可超過 1000 字', invalidMethod: '包含無效或不可選擇的功法',
        saveFailed: '打卡儲存失敗', reminderHourInvalid: '提醒時間必須介於 0 到 23 點', timezoneInvalid: '無效的時區', reminderFailed: '提醒設定失敗'
    },
    zh_CN: {
        languagePrompt: '请选择语言 / 請選擇語言 / Choose your language:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: '语言已设为简体中文。',
        menu: '气功打卡小助手\n\n输入“打卡”：记录今日练功\n输入“统计”：查看连续与累计天数\n输入“提醒”：管理每日提醒\n输入“语言”：切换界面语言\n输入“菜单”：再次显示本说明',
        checkinLink: (minutes: number, link: string) => `请使用这个一次性链接完成今日打卡（${minutes} 分钟内有效）：\n${link}`,
        statsEmpty: '你目前还没有打卡记录。输入“打卡”开始今天的练功。',
        stats: (current: number, longest: number, total: number, last: string) => `你的练功统计\n目前连续打卡：${current} 天\n最长连续打卡：${longest} 天\n总打卡天数：${total} 天\n最近打卡日期：${last}`,
        enabled: '开启', disabled: '关闭',
        reminderStatus: (status: string, hour: number, timezone: string) => `每日提醒目前：${status}\n提醒时间：${hour}:00（${timezone}）\n\n输入“提醒开启”或“提醒关闭”。时间与时区可在打卡页面设置。`,
        reminderOn: '每日打卡提醒已开启。你可以随时输入“提醒关闭”取消。',
        reminderOff: '每日打卡提醒已关闭。',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? '今日打卡已更新。' : '今日打卡完成。'}\n功法：${methods.join('、')}\n目前连续：${current} 天｜累计：${total} 天`,
        selectMethod: '请至少选择一个功法', maxLength: '文字字段不可超过 1000 字', invalidMethod: '包含无效或不可选择的功法',
        saveFailed: '打卡保存失败', reminderHourInvalid: '提醒时间必须介于 0 到 23 点', timezoneInvalid: '无效的时区', reminderFailed: '提醒设置失败'
    },
    en: {
        languagePrompt: 'Choose your language / 請選擇語言 / 请选择语言:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: 'Language set to English.',
        menu: 'Qigong Check-in Assistant\n\nSend "checkin" to record today’s practice\nSend "stats" to view streaks and total days\nSend "reminder" to manage daily reminders\nSend "language" to change the interface language\nSend "menu" to show this help again',
        checkinLink: (minutes: number, link: string) => `Use this one-time link to complete today’s check-in (valid for ${minutes} minutes):\n${link}`,
        statsEmpty: 'You do not have any check-ins yet. Send "checkin" to record today’s practice.',
        stats: (current: number, longest: number, total: number, last: string) => `Your practice statistics\nCurrent streak: ${current} days\nLongest streak: ${longest} days\nTotal check-in days: ${total}\nMost recent check-in: ${last}`,
        enabled: 'On', disabled: 'Off',
        reminderStatus: (status: string, hour: number, timezone: string) => `Daily reminder: ${status}\nReminder time: ${hour}:00 (${timezone})\n\nSend "reminder on" or "reminder off". You can change the time and timezone on the check-in page.`,
        reminderOn: 'Daily check-in reminders are on. Send "reminder off" at any time to stop them.',
        reminderOff: 'Daily check-in reminders are off.',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? 'Today’s check-in was updated.' : 'Today’s check-in is complete.'}\nMethods: ${methods.join(', ')}\nCurrent streak: ${current} days | Total: ${total} days`,
        selectMethod: 'Select at least one practice method', maxLength: 'Text fields cannot exceed 1,000 characters', invalidMethod: 'One or more selected methods are invalid',
        saveFailed: 'Failed to save check-in', reminderHourInvalid: 'Reminder hour must be between 0 and 23', timezoneInvalid: 'Invalid timezone', reminderFailed: 'Failed to save reminder settings'
    }
} as const;

export const t = (locale: Locale) => messages[locale];
