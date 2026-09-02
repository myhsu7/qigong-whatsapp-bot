import crypto from 'crypto';
import { Router } from 'express';
import { requireSameOriginRequest, requireSession } from '../middleware/session';
import { getPracticeMethods } from '../services/taxonomy';
import { getTodayCheckin, listRecentCheckins, saveTodayCheckin } from '../services/checkin';
import { getUserStats } from '../services/stats';
import { getReminderSettings, updateReminderSettings } from '../services/reminders';
import { sendText } from '../platform/whatsapp/client';

const router = Router();
router.use(requireSession, requireSameOriginRequest);

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
    try {
        const methodIds = Array.isArray(req.body?.methodIds)
            ? [...new Set<number>(req.body.methodIds.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))]
            : [];
        const reflectionNote = typeof req.body?.reflectionNote === 'string' ? req.body.reflectionNote : '';
        const bodyFeelingNote = typeof req.body?.bodyFeelingNote === 'string' ? req.body.bodyFeelingNote : '';
        const saved = await saveTodayCheckin(res.locals.waId, methodIds, reflectionNote, bodyFeelingNote);
        const stats = await getUserStats(res.locals.waId);
        res.json({ ok: true, ...saved, stats });
        const summary = [
            saved.alreadyCheckedIn ? '今日打卡已更新。' : '今日打卡完成。',
            `功法：${saved.selectedMethods.join('、')}`,
            `目前連續：${stats.currentStreak} 天｜累計：${stats.totalCheckins} 天`
        ].join('\n');
        const summaryHash = crypto.createHash('sha256').update(JSON.stringify({ methodIds, reflectionNote, bodyFeelingNote })).digest('hex').slice(0, 20);
        sendText(res.locals.waId, summary, `checkin:${saved.checkinLogId}:${summaryHash}`)
            .catch((error) => console.error('[checkin] failed to send summary', error));
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const validationError = message.startsWith('請至少選擇') || message.startsWith('文字欄位') || message.startsWith('包含無效');
        if (!validationError) console.error('[checkin] failed to save', error);
        res.status(validationError ? 400 : 500).json({ error: validationError ? message : '打卡儲存失敗' });
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
        res.json({ entries: await listRecentCheckins(res.locals.waId) });
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
    try {
        const reminderEnabled = typeof req.body?.reminderEnabled === 'boolean' ? req.body.reminderEnabled : undefined;
        const reminderHour = req.body?.reminderHour === undefined ? undefined : Number(req.body.reminderHour);
        const reminderTimezone = typeof req.body?.reminderTimezone === 'string' ? req.body.reminderTimezone : undefined;
        res.json(await updateReminderSettings(res.locals.waId, { reminderEnabled, reminderHour, reminderTimezone }));
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const validationError = message === '提醒時間必須介於 0 到 23 點' || message === '無效的時區';
        if (!validationError) console.error('[reminders] failed to update', error);
        res.status(validationError ? 400 : 500).json({ error: validationError ? message : '提醒設定失敗' });
    }
});

export default router;
