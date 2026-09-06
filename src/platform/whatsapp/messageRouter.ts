import { env } from '../../config/env';
import { Locale, t } from '../../i18n';
import { detectLocaleFromText, getLanguagePreference, localeFromSelection, setLanguagePreference } from '../../services/language';
import { getReminderSettings, updateReminderSettings } from '../../services/reminders';
import { issueMagicLink } from '../../services/session';
import { buildStatsMessage, getUserStats } from '../../services/stats';
import { ReplyButton, sendInteractiveButtons, sendText } from './client';

export type Command = 'menu' | 'checkin' | 'stats' | 'reminder' | 'reminder-on' | 'reminder-off' | 'language' | 'unknown';

export const normalizeCommand = (input: string): Command => {
    const value = input.trim().toLowerCase().replace(/^\//, '');
    if (['開始', '开始', '選單', '菜单', 'menu', 'start', 'help', '說明', '说明'].includes(value)) return 'menu';
    if (['打卡', 'checkin'].includes(value)) return 'checkin';
    if (['統計', '统计', 'stats'].includes(value)) return 'stats';
    if (['提醒', 'reminder'].includes(value)) return 'reminder';
    if (['提醒開啟', '開啟提醒', '提醒开启', '开启提醒', 'reminder on'].includes(value)) return 'reminder-on';
    if (['提醒關閉', '關閉提醒', '提醒关闭', '关闭提醒', 'reminder off', '停止', 'stop'].includes(value)) return 'reminder-off';
    if (['語言', '语言', 'language'].includes(value)) return 'language';
    return 'unknown';
};

const selectLanguage = async (waId: string, locale: Locale, responseKey: string) => {
    await setLanguagePreference(waId, locale);
    const messages = t(locale);
    return sendText(waId, `${messages.languageSaved}\n\n${messages.menu}`, responseKey);
};

const sendMenu = async (waId: string, locale: Locale, responseKey: string) => {
    const messages = t(locale);
    const link = await issueMagicLink(waId, 'dashboard');
    const text = messages.dashboardMenu(env.magicLinkTtlMinutes, link);
    try {
        return await sendInteractiveButtons(waId, text, [...messages.menuButtons] as ReplyButton[], responseKey);
    } catch (error) {
        console.error('[whatsapp-menu] interactive message failed, using text fallback', error instanceof Error ? error.message : error);
        return sendText(waId, `${text}\n\n${messages.menu}`, `${responseKey}:fallback`);
    }
};

export const routeInboundMessage = async (waId: string, text: string, messageId: string) => {
    const responseKey = `inbound:${messageId}:response`;
    const selectedLocale = localeFromSelection(text);
    if (selectedLocale) return selectLanguage(waId, selectedLocale, responseKey);

    const preference = await getLanguagePreference(waId);
    let locale = preference.locale;
    if (!preference.selected) {
        const detected = detectLocaleFromText(text);
        if (!detected) return sendText(waId, t('zh_TW').languagePrompt, responseKey);
        locale = detected;
        await setLanguagePreference(waId, locale);
    }

    const messages = t(locale);
    switch (normalizeCommand(text)) {
        case 'checkin': {
            const link = await issueMagicLink(waId);
            return sendText(waId, messages.checkinLink(env.magicLinkTtlMinutes, link), responseKey);
        }
        case 'stats':
            return sendText(waId, buildStatsMessage(await getUserStats(waId), locale), responseKey);
        case 'reminder': {
            const settings = await getReminderSettings(waId);
            return sendText(waId, messages.reminderStatus(
                settings.reminderEnabled ? messages.enabled : messages.disabled,
                settings.reminderHour,
                settings.reminderTimezone
            ), responseKey);
        }
        case 'reminder-on':
            await updateReminderSettings(waId, { reminderEnabled: true });
            return sendText(waId, messages.reminderOn, responseKey);
        case 'reminder-off':
            await updateReminderSettings(waId, { reminderEnabled: false });
            return sendText(waId, messages.reminderOff, responseKey);
        case 'language':
            return sendText(waId, messages.languagePrompt, responseKey);
        case 'menu':
        case 'unknown':
            return sendMenu(waId, locale, responseKey);
    }
};
