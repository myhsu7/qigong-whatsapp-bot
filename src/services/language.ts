import { db } from '../db';
import { Locale, normalizeLocale } from '../i18n';

export interface LanguagePreference {
    locale: Locale;
    selected: boolean;
}

export const getLanguagePreference = async (waId: string): Promise<LanguagePreference> => {
    const { rows } = await db.query('SELECT language_code, language_selected FROM whatsapp_users WHERE wa_id = $1', [waId]);
    return { locale: normalizeLocale(rows[0]?.language_code), selected: Boolean(rows[0]?.language_selected) };
};

export const setLanguagePreference = async (waId: string, locale: Locale) => {
    await db.query(
        `UPDATE whatsapp_users SET language_code = $2, language_selected = TRUE,
         updated_at = CURRENT_TIMESTAMP WHERE wa_id = $1`,
        [waId, locale]
    );
};

export const localeFromSelection = (input: string): Locale | null => {
    const value = input.trim().toLowerCase();
    if (['繁體中文', '繁体中文', 'traditional chinese', 'zh-tw', '1'].includes(value)) return 'zh_TW';
    if (['简体中文', '簡體中文', 'simplified chinese', 'zh-cn', '2'].includes(value)) return 'zh_CN';
    if (['english', '英文', 'en', '3'].includes(value)) return 'en';
    return null;
};

export const detectLocaleFromText = (input: string): Locale | null => {
    const selected = localeFromSelection(input);
    if (selected) return selected;
    if (/[统计简语开关练录设页链这]/.test(input)) return 'zh_CN';
    if (/[統計體語開關練錄設頁鏈這]/.test(input)) return 'zh_TW';
    if (/[a-z]/i.test(input) && !/[\u3400-\u9fff]/.test(input)) return 'en';
    return null;
};
