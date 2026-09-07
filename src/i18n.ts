export const supportedLocales = ['zh_TW', 'zh_CN', 'en'] as const;
export type Locale = typeof supportedLocales[number];

export const normalizeLocale = (value: unknown): Locale =>
    supportedLocales.includes(value as Locale) ? value as Locale : 'zh_TW';

const messages = {
    zh_TW: {
        languagePrompt: '請選擇語言 / 请选择语言 / Choose your language:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: '語言已設為繁體中文。',
        menu: '氣功打卡小幫手\n\n輸入「打卡」：記錄今日練功\n輸入「統計」：查看連續與累計天數\n輸入「提醒」：管理每日提醒\n輸入「語言」：切換介面語言\n輸入「選單」：再次顯示本說明',
        dashboardMenu: (minutes: number, link: string) => `氣功修練中心\n\n開啟 Dashboard 完成打卡、查看統計與紀錄，或管理每日提醒。連結為一次性使用，${minutes} 分鐘內有效：\n${link}`,
        menuButtons: [{ id: 'checkin', title: '今日打卡' }, { id: 'stats', title: '查看統計' }, { id: 'reminder', title: '提醒設定' }],
        checkinLink: (minutes: number, link: string) => `請使用這個一次性連結完成今日打卡（${minutes} 分鐘內有效）：\n${link}`,
        statsEmpty: '你目前還沒有打卡紀錄。輸入「打卡」開始今天的練功。',
        stats: (current: number, longest: number, total: number, last: string) => `你的練功統計\n目前連續打卡：${current} 天\n最長連續打卡：${longest} 天\n總打卡天數：${total} 天\n最近打卡日期：${last}`,
        level: (title: string) => `目前境界：${title}`,
        newBadges: (badges: string[]) => `\n新解鎖：${badges.join('、')}`,
        enabled: '開啟', disabled: '關閉',
        reminderStatus: (status: string, hour: number, timezone: string) => `每日提醒目前：${status}\n提醒時間：${hour}:00（${timezone}）\n\n輸入「提醒開啟」或「提醒關閉」。時間與時區可在打卡頁設定。`,
        reminderOn: '每日打卡提醒已開啟。你可以隨時輸入「提醒關閉」取消。',
        reminderOff: '每日打卡提醒已關閉。',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? '今日打卡已更新。' : '今日打卡完成。'}\n功法：${methods.join('、')}\n目前連續：${current} 天｜累計：${total} 天`,
        selectMethod: '請至少選擇一個功法', maxLength: '心得與感受不可超過 1000 字', invalidMethod: '包含無效或不可選擇的功法',
        saveFailed: '打卡儲存失敗', reminderHourInvalid: '提醒時間必須介於 0 到 23 點', timezoneInvalid: '無效的時區', reminderFailed: '提醒設定失敗'
    },
    zh_CN: {
        languagePrompt: '请选择语言 / 請選擇語言 / Choose your language:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: '语言已设为简体中文。',
        menu: '气功打卡小助手\n\n输入“打卡”：记录今日练功\n输入“统计”：查看连续与累计天数\n输入“提醒”：管理每日提醒\n输入“语言”：切换界面语言\n输入“菜单”：再次显示本说明',
        dashboardMenu: (minutes: number, link: string) => `气功修练中心\n\n打开 Dashboard 完成打卡、查看统计与记录，或管理每日提醒。链接仅可使用一次，${minutes} 分钟内有效：\n${link}`,
        menuButtons: [{ id: 'checkin', title: '今日打卡' }, { id: 'stats', title: '查看统计' }, { id: 'reminder', title: '提醒设置' }],
        checkinLink: (minutes: number, link: string) => `请使用这个一次性链接完成今日打卡（${minutes} 分钟内有效）：\n${link}`,
        statsEmpty: '你目前还没有打卡记录。输入“打卡”开始今天的练功。',
        stats: (current: number, longest: number, total: number, last: string) => `你的练功统计\n目前连续打卡：${current} 天\n最长连续打卡：${longest} 天\n总打卡天数：${total} 天\n最近打卡日期：${last}`,
        level: (title: string) => `目前境界：${title}`,
        newBadges: (badges: string[]) => `\n新解锁：${badges.join('、')}`,
        enabled: '开启', disabled: '关闭',
        reminderStatus: (status: string, hour: number, timezone: string) => `每日提醒目前：${status}\n提醒时间：${hour}:00（${timezone}）\n\n输入“提醒开启”或“提醒关闭”。时间与时区可在打卡页面设置。`,
        reminderOn: '每日打卡提醒已开启。你可以随时输入“提醒关闭”取消。',
        reminderOff: '每日打卡提醒已关闭。',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? '今日打卡已更新。' : '今日打卡完成。'}\n功法：${methods.join('、')}\n目前连续：${current} 天｜累计：${total} 天`,
        selectMethod: '请至少选择一个功法', maxLength: '心得与感受不可超过 1000 字', invalidMethod: '包含无效或不可选择的功法',
        saveFailed: '打卡保存失败', reminderHourInvalid: '提醒时间必须介于 0 到 23 点', timezoneInvalid: '无效的时区', reminderFailed: '提醒设置失败'
    },
    en: {
        languagePrompt: 'Choose your language / 請選擇語言 / 请选择语言:\n\n1. 繁體中文\n2. 简体中文\n3. English',
        languageSaved: 'Language set to English.',
        menu: 'Qigong Check-in Assistant\n\nSend "checkin" to record today’s practice\nSend "stats" to view streaks and total days\nSend "reminder" to manage daily reminders\nSend "language" to change the interface language\nSend "menu" to show this help again',
        dashboardMenu: (minutes: number, link: string) => `Qigong Practice Center\n\nOpen your dashboard to check in, review stats and history, or manage daily reminders. This single-use link is valid for ${minutes} minutes:\n${link}`,
        menuButtons: [{ id: 'checkin', title: 'Check in' }, { id: 'stats', title: 'View stats' }, { id: 'reminder', title: 'Reminders' }],
        checkinLink: (minutes: number, link: string) => `Use this one-time link to complete today’s check-in (valid for ${minutes} minutes):\n${link}`,
        statsEmpty: 'You do not have any check-ins yet. Send "checkin" to record today’s practice.',
        stats: (current: number, longest: number, total: number, last: string) => `Your practice statistics\nCurrent streak: ${current} days\nLongest streak: ${longest} days\nTotal check-in days: ${total}\nMost recent check-in: ${last}`,
        level: (title: string) => `Current level: ${title}`,
        newBadges: (badges: string[]) => `\nNewly unlocked: ${badges.join(', ')}`,
        enabled: 'On', disabled: 'Off',
        reminderStatus: (status: string, hour: number, timezone: string) => `Daily reminder: ${status}\nReminder time: ${hour}:00 (${timezone})\n\nSend "reminder on" or "reminder off". You can change the time and timezone on the check-in page.`,
        reminderOn: 'Daily check-in reminders are on. Send "reminder off" at any time to stop them.',
        reminderOff: 'Daily check-in reminders are off.',
        summary: (updated: boolean, methods: string[], current: number, total: number) => `${updated ? 'Today’s check-in was updated.' : 'Today’s check-in is complete.'}\nMethods: ${methods.join(', ')}\nCurrent streak: ${current} days | Total: ${total} days`,
        selectMethod: 'Select at least one practice method', maxLength: 'Reflection and sensations cannot exceed 1,000 characters', invalidMethod: 'One or more selected methods are invalid',
        saveFailed: 'Failed to save check-in', reminderHourInvalid: 'Reminder hour must be between 0 and 23', timezoneInvalid: 'Invalid timezone', reminderFailed: 'Failed to save reminder settings'
    }
} as const;

export const t = (locale: Locale) => messages[locale];

const badgeNames: Record<string, Record<Locale, [string, string]>> = {
    streak_3: { zh_TW: ['入門', '連續打卡 3 天'], zh_CN: ['入门', '连续打卡 3 天'], en: ['First Steps', 'Checked in for 3 consecutive days'] },
    streak_7: { zh_TW: ['小成', '連續打卡 7 天'], zh_CN: ['小成', '连续打卡 7 天'], en: ['Early Progress', 'Checked in for 7 consecutive days'] },
    streak_21: { zh_TW: ['結丹', '連續打卡 21 天'], zh_CN: ['结丹', '连续打卡 21 天'], en: ['Inner Foundation', 'Checked in for 21 consecutive days'] },
    streak_100: { zh_TW: ['百日築基', '連續打卡 100 天'], zh_CN: ['百日筑基', '连续打卡 100 天'], en: ['Hundred-Day Foundation', 'Checked in for 100 consecutive days'] },
    total_10: { zh_TW: ['初芽', '總計打卡 10 天'], zh_CN: ['初芽', '累计打卡 10 天'], en: ['First Sprout', 'Completed 10 total check-in days'] },
    total_100: { zh_TW: ['大樹', '總計打卡 100 天'], zh_CN: ['大树', '累计打卡 100 天'], en: ['Flourishing Tree', 'Completed 100 total check-in days'] },
    time_morning: { zh_TW: ['晨露', '連續 5 天在早上 5:00 - 7:00 打卡'], zh_CN: ['晨露', '连续 5 天在早上 5:00 - 7:00 打卡'], en: ['Morning Dew', 'Checked in between 5:00 and 7:00 AM for 5 consecutive days'] },
    time_night: { zh_TW: ['夜靜', '連續 5 天在晚上 9:00 - 11:00 打卡'], zh_CN: ['夜静', '连续 5 天在晚上 9:00 - 11:00 打卡'], en: ['Quiet Night', 'Checked in between 9:00 and 11:00 PM for 5 consecutive days'] },
    seasonal_summer_27: { zh_TW: ['夏練三伏', '於當年三伏期間完成全程打卡'], zh_CN: ['夏练三伏', '在当年三伏期间完成全程打卡'], en: ['Summer Sanfu Practice', 'Completed every check-in during the annual Sanfu period'] },
    seasonal_winter_27: { zh_TW: ['冬練三九', '冬至後連續 27 天打卡並練習龜壽功'], zh_CN: ['冬练三九', '冬至后连续 27 天打卡并练习龟寿功'], en: ['Winter Sanjiu Practice', 'Practiced Longevity Guishou for 27 consecutive days after winter solstice'] }
};

const badgeMethodNames: Record<string, Record<Locale, string>> = {
    dayan: { zh_TW: '大雁功', zh_CN: '大雁功', en: 'EnerQi Dayan' },
    wuqinxi: { zh_TW: '五禽戲', zh_CN: '五禽戏', en: 'Five Animal Frolics Wuqinxi' },
    huichun: { zh_TW: '回春功', zh_CN: '回春功', en: 'YoungQi Huichun' },
    guishou: { zh_TW: '龜壽功', zh_CN: '龟寿功', en: 'Longevity Guishou' },
    zhengyang: { zh_TW: '正陽功', zh_CN: '正阳功', en: 'VitalQi' },
    huanghai: { zh_TW: '神奇晃海功', zh_CN: '神奇晃海功', en: 'FlowQi-Neuro' },
    lotus: { zh_TW: '蓮花養心法', zh_CN: '莲花养心法', en: 'LotusQi' },
    heqi: { zh_TW: '和氣舒壓法', zh_CN: '和气舒压法', en: 'HarmonyQi' },
    sanwo: { zh_TW: '三窩功', zh_CN: '三窝功', en: 'Sanwo Gong' },
    liuyin: { zh_TW: '六音理臟法', zh_CN: '六音理脏法', en: 'DetoxQi Liuyin' },
    jinggong: { zh_TW: '靜功', zh_CN: '静功', en: 'Quiet Practice' }
};

export const localizeBadge = <T extends { id: string; name: string; description: string }>(badge: T, locale: Locale): T => {
    const fixed = badgeNames[badge.id]?.[locale];
    if (fixed) return { ...badge, name: fixed[0], description: fixed[1] };
    const methodMatch = badge.id.match(/^method_(.+)_(7|30|100)$/);
    if (methodMatch) {
        const method = badgeMethodNames[methodMatch[1]]?.[locale];
        const days = methodMatch[2];
        if (method) return {
            ...badge,
            name: locale === 'en' ? `${method} | ${days}-Day Milestone` : locale === 'zh_CN' ? `${method}｜累计 ${days} 天` : badge.name,
            description: locale === 'en' ? `Practiced ${method} on ${days} days` : locale === 'zh_CN' ? `累计练习「${method}」${days} 天` : badge.description
        };
    }
    const comboMatch = badge.id.match(/^combo_(.+)$/);
    if (comboMatch) {
        const method = badgeMethodNames[comboMatch[1]]?.[locale];
        if (method && locale !== 'zh_TW') return {
            ...badge,
            name: locale === 'en' ? `${method} Complete Set` : `${method}全套完成`,
            description: locale === 'en' ? `Completed every active form of ${method} on the same day. Unlockable annually.` : `同日完成「${method}」全部功法，每年可重新解锁`
        };
    }
    return badge;
};

export const levelTitle = (code: string, locale: Locale) => ({
    qi: { zh_TW: '練氣', zh_CN: '练气', en: 'Qi Cultivation' },
    foundation: { zh_TW: '築基', zh_CN: '筑基', en: 'Foundation' },
    core: { zh_TW: '結丹', zh_CN: '结丹', en: 'Inner Core' },
    mastery: { zh_TW: '化境', zh_CN: '化境', en: 'Mastery' }
}[code]?.[locale] || code);
