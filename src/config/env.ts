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
    reminderEnabled: process.env.WHATSAPP_REMINDER_ENABLED === 'true',
    reminderTemplate: process.env.WHATSAPP_REMINDER_TEMPLATE || 'qigong_daily_checkin_reminder',
    reminderTemplateLanguage: process.env.WHATSAPP_REMINDER_TEMPLATE_LANGUAGE || 'zh_TW',
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
