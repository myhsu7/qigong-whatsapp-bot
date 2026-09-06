import crypto from 'crypto';
import { Router } from 'express';
import { requireSameOriginRequest, requireSession } from '../middleware/session';
import { getPracticeMethods } from '../services/taxonomy';
import { getTodayCheckin, listRecentCheckins, saveTodayCheckin } from '../services/checkin';
import { calculateLevel, getUserStats } from '../services/stats';
import { getReminderSettings, updateReminderSettings } from '../services/reminders';
import { sendText } from '../platform/whatsapp/client';
import { getLanguagePreference, setLanguagePreference } from '../services/language';
import { levelTitle, normalizeLocale, t } from '../i18n';
import { UserInputError } from '../errors';
import { evaluateBadges, getUserBadges } from '../services/badges';
import { getCalendar } from '../services/calendar';
import { db } from '../db';
import { getPracticeAnalysis, parseAnalysisWindow } from '../services/analysis';
import { generateAnalysisCommentary } from '../services/localLlm';

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
        const newBadges = await evaluateBadges(res.locals.waId, locale).catch((error) => {
            console.error('[badges] failed to evaluate after check-in', error);
            return [];
        });
        const stats = await getUserStats(res.locals.waId);
        res.json({ ok: true, ...saved, stats: { ...stats, level: calculateLevel(stats.totalCheckins) }, newBadges });
        const summary = messages.summary(saved.alreadyCheckedIn, saved.selectedMethods, stats.currentStreak, stats.totalCheckins)
            + (newBadges.length ? messages.newBadges(newBadges.map((badge) => `${badge.emoji} ${badge.name}`)) : '');
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
        const stats = await getUserStats(res.locals.waId);
        res.json({ ...stats, level: calculateLevel(stats.totalCheckins) });
    } catch (error) {
        next(error);
    }
});

router.get('/analysis', async (req, res, next) => {
    const period = parseAnalysisWindow(req.query.window);
    if (!period) {
        res.status(400).json({ error: 'Analysis window must be 30 or 90 days' });
        return;
    }
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(await getPracticeAnalysis(res.locals.waId, period, locale));
    } catch (error) {
        next(error);
    }
});

router.post('/analysis/commentary', async (req, res, next) => {
    const period = parseAnalysisWindow(req.body?.window);
    if (!period) {
        res.status(400).json({ error: 'Analysis window must be 30 or 90 days' });
        return;
    }
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        const analysis = await getPracticeAnalysis(res.locals.waId, period, locale);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(await generateAnalysisCommentary(res.locals.waId, analysis, locale));
    } catch (error) {
        next(error);
    }
});

router.get('/achievements', async (_req, res, next) => {
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        const [stats, badges, catalog] = await Promise.all([
            getUserStats(res.locals.waId),
            getUserBadges(res.locals.waId, locale),
            db.query('SELECT COUNT(*) AS count FROM whatsapp_badges')
        ]);
        const level = calculateLevel(stats.totalCheckins);
        res.json({
            stats,
            level: {
                ...level,
                title: levelTitle(level.code, locale),
                nextTitle: level.nextThreshold === null ? null : levelTitle(calculateLevel(level.nextThreshold).code, locale)
            },
            badges,
            earnedCount: new Set(badges.map((badge) => badge.id)).size,
            totalAvailable: Number(catalog.rows[0].count)
        });
    } catch (error) {
        next(error);
    }
});

router.get('/calendar', async (req, res, next) => {
    try {
        const { locale } = await getLanguagePreference(res.locals.waId);
        const month = typeof req.query.month === 'string' ? req.query.month : undefined;
        res.json(await getCalendar(res.locals.waId, month, locale));
    } catch (error) {
        if (error instanceof UserInputError) {
            res.status(400).json({ error: 'Invalid month; expected YYYY-MM' });
            return;
        }
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
