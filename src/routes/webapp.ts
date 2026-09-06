import path from 'path';
import { Router } from 'express';
import { env } from '../config/env';
import { consumeMagicLink } from '../services/session';

const router = Router();

router.get('/auth', async (req, res) => {
    try {
        const token = typeof req.query.t === 'string' ? req.query.t : '';
        if (!token) throw new Error('缺少登入資訊');
        const { session, purpose } = await consumeMagicLink(token);
        const maxAge = env.sessionTtlHours * 60 * 60;
        res.setHeader('Set-Cookie', [
            `qigong_wa_session=${encodeURIComponent(session)}; Max-Age=${maxAge}; Path=/whatsapp; HttpOnly; SameSite=Lax${env.publicBaseUrl.startsWith('https://') ? '; Secure' : ''}`
        ]);
        res.redirect(purpose === 'dashboard' ? '/whatsapp/webapp/dashboard' : '/whatsapp/webapp/checkin');
    } catch (error) {
        console.error('[webapp-auth] magic link rejected', error instanceof Error ? error.message : error);
        res.status(401).type('html').send('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Link expired</title><body><p>連結無效、已使用或已過期。/ 链接无效、已使用或已过期。/ This link is invalid, used, or expired.</p><p>請回到 WhatsApp 重新輸入「打卡」。/ Return to WhatsApp and send "checkin" again.</p></body></html>');
    }
});

router.get(['/dashboard', '/checkin'], (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'public', 'index.html'));
});

export default router;
