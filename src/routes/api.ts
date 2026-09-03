import crypto from 'crypto';
import { Router } from 'express';
import { requireSameOriginRequest, requireSession } from '../middleware/session';
import { getPracticeMethods } from '../services/taxonomy';
import { getTodayCheckin, listRecentCheckins, saveTodayCheckin } from '../services/checkin';
import { getUserStats } from '../services/stats';
import { getReminderSettings, updateReminderSettings } from '../services/reminders';
import { sendText } from '../platform/whatsapp/client';
import { getLanguagePreference, setLanguagePreference } from '../services/language';
import { normalizeLocale, t } from '../i18n';
import { UserInputError } from '../errors';

const router = Router();
router.use(requireSession, requireSameOriginRequest);

router.get('/profile', async (_req, res, next) => {
    try {
        res.json(await getLanguagePreference(res.locals.waId));
    } catch (error) {
        next(error);
    }
});

router.patch('/profile/language', async (req, res) => {
    const locale = normalizeLocale(req.body?.locale);
    if (locale !== req.body?.locale) {
        res.status(400).json({ error: 'Unsupported language' });
        return;
    }
    await setLanguagePreference(res.locals.waId, locale);
    res.json({ locale, selected: true });
});

router.get('/practice-methods', async (_req, res, next) => {
    try {
        res.json({ methods: await getPracticeMethods() });
    } catch (error) {
        next(error);
    }
});

router.get('/checkin/today', async (_req, res, next) => {
    try {
        res.json(await getTodayCheckin(res.locals.waId));
    } catch (error) {
        next(error);
    }
});

router.post('/checkin', async (req, res) => {
    let messages = t('zh_TW');
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        messages = t(locale);
        const methodIds = Array.isArray(req.body?.methodIds)
            ? [...new Set<number>(req.body.methodIds.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))]
            : [];
        const reflectionNote = typeof req.body?.reflectionNote === 'string' ? req.body.reflectionNote : '';
        const bodyFeelingNote = typeof req.body?.bodyFeelingNote === 'string' ? req.body.bodyFeelingNote : '';
        const saved = await saveTodayCheckin(res.locals.waId, methodIds, reflectionNote, bodyFeelingNote, locale);
        const stats = await getUserStats(res.locals.waId);
        res.json({ ok: true, ...saved, stats });
        const summary = messages.summary(saved.alreadyCheckedIn, saved.selectedMethods, stats.currentStreak, stats.totalCheckins);
        const summaryHash = crypto.createHash('sha256').update(JSON.stringify({ methodIds, reflectionNote, bodyFeelingNote })).digest('hex').slice(0, 20);
        sendText(res.locals.waId, summary, `checkin:${saved.checkinLogId}:${summaryHash}`)
            .catch((error) => console.error('[checkin] failed to send summary', error));
    } catch (error) {
        if (!(error instanceof UserInputError)) console.error('[checkin] failed to save', error);
        const inputMessages = { select_method: messages.selectMethod, max_length: messages.maxLength, invalid_method: messages.invalidMethod };
        res.status(error instanceof UserInputError ? 400 : 500).json({
            error: error instanceof UserInputError && error.code in inputMessages
                ? inputMessages[error.code as keyof typeof inputMessages]
                : messages.saveFailed
        });
    }
});

router.get('/stats', async (_req, res, next) => {
    try {
        res.json(await getUserStats(res.locals.waId));
    } catch (error) {
        next(error);
    }
});

router.get('/history', async (_req, res, next) => {
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        res.json({ entries: await listRecentCheckins(res.locals.waId, locale) });
    } catch (error) {
        next(error);
    }
});

router.get('/reminders', async (_req, res, next) => {
    try {
        res.json(await getReminderSettings(res.locals.waId));
    } catch (error) {
        next(error);
    }
});

router.patch('/reminders', async (req, res) => {
    let messages = t('zh_TW');
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        messages = t(locale);
        const reminderEnabled = typeof req.body?.reminderEnabled === 'boolean' ? req.body.reminderEnabled : undefined;
        const reminderHour = req.body?.reminderHour === undefined ? undefined : Number(req.body.reminderHour);
        const reminderTimezone = typeof req.body?.reminderTimezone === 'string' ? req.body.reminderTimezone : undefined;
        res.json(await updateReminderSettings(res.locals.waId, { reminderEnabled, reminderHour, reminderTimezone }));
    } catch (error) {
        if (!(error instanceof UserInputError)) console.error('[reminders] failed to update', error);
        const message = error instanceof UserInputError && error.code === 'reminder_hour'
            ? messages.reminderHourInvalid
            : error instanceof UserInputError && error.code === 'timezone'
                ? messages.timezoneInvalid
                : messages.reminderFailed;
        res.status(error instanceof UserInputError ? 400 : 500).json({ error: message });
    }
});

export default router;
