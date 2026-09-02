import { RequestHandler } from 'express';
import { resolveSession } from '../services/session';

const parseCookies = (value: string | undefined): Record<string, string> => {
    const cookies: Record<string, string> = {};
    for (const part of (value || '').split(';')) {
        const separator = part.indexOf('=');
        if (separator < 1) continue;
        try {
            cookies[decodeURIComponent(part.slice(0, separator).trim())] = decodeURIComponent(part.slice(separator + 1).trim());
        } catch {
            // Malformed cookies are treated as absent authentication.
        }
    }
    return cookies;
};

export const requireSession: RequestHandler = async (req, res, next) => {
    try {
        const session = parseCookies(req.header('cookie')).qigong_wa_session || '';
        const waId = await resolveSession(session);
        if (!waId) {
            res.status(401).json({ error: '登入已過期，請回到 WhatsApp 重新輸入「打卡」' });
            return;
        }
        res.locals.waId = waId;
        next();
    } catch (error) {
        next(error);
    }
};

export const requireSameOriginRequest: RequestHandler = (req, res, next) => {
    if (req.method === 'GET' || req.header('x-requested-with') === 'qigong-webapp') {
        next();
        return;
    }
    res.status(403).json({ error: 'Invalid request origin' });
};
