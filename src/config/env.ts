import * as dotenv from 'dotenv';

dotenv.config();

const integer = (value: string | undefined, fallback: number, min: number, max: number) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export const env = {
    port: integer(process.env.PORT, 3002, 1, 65535),
    publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
    databaseUrl: process.env.DATABASE_URL || '',
    metaGraphVersion: process.env.META_GRAPH_VERSION || 'v23.0',
    metaAppSecret: process.env.META_APP_SECRET || '',
    metaVerifyToken: process.env.META_VERIFY_TOKEN || '',
    metaAccessToken: process.env.META_ACCESS_TOKEN || '',
    metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    whatsappBusinessNumber: (process.env.WHATSAPP_BUSINESS_NUMBER || '').trim(),
    localLlmEnabled: process.env.LOCAL_LLM_ENABLED === 'true',
    localLlmBaseUrl: (process.env.LOCAL_LLM_BASE_URL || '').replace(/\/$/, ''),
    localLlmModel: process.env.LOCAL_LLM_MODEL || '',
    localLlmApiKey: process.env.LOCAL_LLM_API_KEY || '',
    localLlmTimeoutMs: integer(process.env.LOCAL_LLM_TIMEOUT_MS, 10000, 1000, 15000),
    localLlmMinCheckins: integer(process.env.LOCAL_LLM_MIN_CHECKINS, 5, 1, 100),
    reminderEnabled: process.env.WHATSAPP_REMINDER_ENABLED === 'true',
    reminderTemplates: {
        zh_TW: {
            name: process.env.WHATSAPP_REMINDER_TEMPLATE_ZH_TW || process.env.WHATSAPP_REMINDER_TEMPLATE || 'qigong_daily_checkin_reminder',
            language: process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE_ZH_TW || process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE || 'zh_TW'
        },
        zh_CN: {
            name: process.env.WHATSAPP_REMINDER_TEMPLATE_ZH_CN || 'qigong_daily_checkin_reminder_zh_cn',
            language: process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE_ZH_CN || 'zh_CN'
        },
        en: {
            name: process.env.WHATSAPP_REMINDER_TEMPLATE_EN || 'qigong_daily_checkin_reminder_en',
            language: process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE_EN || 'en'
        }
    },
    sessionTtlHours: integer(process.env.SESSION_TTL_HOURS, 168, 1, 720),
    magicLinkTtlMinutes: integer(process.env.MAGIC_LINK_TTL_MINUTES, 15, 1, 60)
};

export const missingMetaConfiguration = () => [
    ['META_APP_SECRET', env.metaAppSecret],
    ['META_VERIFY_TOKEN', env.metaVerifyToken],
    ['META_ACCESS_TOKEN', env.metaAccessToken],
    ['META_PHONE_NUMBER_ID', env.metaPhoneNumberId],
    ['PUBLIC_BASE_URL', env.publicBaseUrl]
].filter(([, value]) => !value).map(([key]) => key);

export const missingRuntimeConfiguration = () => [
    ['DATABASE_URL', env.databaseUrl],
    ['PUBLIC_BASE_URL', env.publicBaseUrl],
    ['META_APP_SECRET', env.metaAppSecret],
    ['META_VERIFY_TOKEN', env.metaVerifyToken],
    ['META_ACCESS_TOKEN', env.metaAccessToken],
    ['META_PHONE_NUMBER_ID', env.metaPhoneNumberId]
].filter(([, value]) => !value).map(([key]) => key);

export const buildWhatsAppChatUrl = (number = env.whatsappBusinessNumber) =>
    /^[1-9]\d{7,14}$/.test(number) ? `https://wa.me/${number}` : null;

export const missingLocalLlmConfiguration = () => [
    ['LOCAL_LLM_BASE_URL', env.localLlmBaseUrl],
    ['LOCAL_LLM_MODEL', env.localLlmModel]
].filter(([, value]) => !value).map(([key]) => key);
