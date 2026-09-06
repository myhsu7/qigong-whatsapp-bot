import crypto from 'crypto';
import { env, missingLocalLlmConfiguration } from '../config/env';
import { Locale } from '../i18n';
import { PracticeAnalysis, buildRuleBasedCommentary } from './analysis';

const PROMPT_VERSION = 'analysis-v1';
const SUCCESS_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 30_000;
const COOLDOWN_MS = 10_000;
const cache = new Map<string, { result: CommentaryResult; expiresAt: number }>();
const pending = new Map<string, Promise<CommentaryResult>>();
const lastRequest = new Map<string, number>();
let healthCache: { result: LlmHealth; expiresAt: number } | undefined;
let healthPending: Promise<LlmHealth> | undefined;

export interface CommentaryResult {
    text: string;
    source: 'llm' | 'fallback';
    reason?: 'disabled' | 'insufficient_data' | 'invalid_configuration' | 'rate_limited' | 'upstream_error';
}

export interface LlmHealth {
    enabled: boolean;
    ok: boolean;
    checkedAt: string;
    status: 'disabled' | 'available' | 'missing_configuration' | 'invalid_url' | 'model_unavailable' | 'request_failed';
    latencyMs?: number;
}

export const isPrivateLlmUrl = (value: string) => {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
        const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
        if (host === 'localhost' || host === '::1') return true;
        if (host.includes(':') && (/^(fc|fd)/.test(host) || /^fe[89ab]/.test(host))) return true;
        const parts = host.split('.').map(Number);
        if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
        return parts[0] === 10
            || parts[0] === 127
            || (parts[0] === 192 && parts[1] === 168)
            || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
            || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
    } catch {
        return false;
    }
};

const languageName = (locale: Locale) => locale === 'en' ? 'English' : locale === 'zh_CN' ? 'Simplified Chinese' : 'Traditional Chinese';

export const buildLlmPrompt = (analysis: PracticeAnalysis, locale: Locale) => {
    const methods = analysis.groupMethods.slice(0, 8).map((method) => ({
        method: method.methodName,
        practicedDays: method.matchedDays,
        attendancePercent: Number((method.attendanceRatio * 100).toFixed(1)),
        compositionPercent: Number((method.compositionRatio * 100).toFixed(1))
    }));
    return {
        system: [
            'You are a supportive Qigong practice assistant.',
            `Reply only in ${languageName(locale)} and keep the response under 400 characters.`,
            'Use only the aggregate data provided. Do not invent facts.',
            'Discuss consistency, balance, focus, and one practical next step.',
            'Do not diagnose illness, promise treatment outcomes, or give medical advice.',
            'If discomfort is mentioned, advise consulting a qualified healthcare professional.',
            'Return plain text without a heading.'
        ].join('\n'),
        user: JSON.stringify({
            periodDays: analysis.periodDays,
            totalCheckinDays: analysis.totalCheckinDays,
            attendancePercent: Number((analysis.attendanceRate * 100).toFixed(1)),
            currentStreak: analysis.currentStreak,
            longestStreak: analysis.longestStreak,
            trend: analysis.trend,
            methods
        })
    };
};

const trimCommentary = (value: string) => {
    const characters = Array.from(value.trim());
    return characters.length <= 500 ? characters.join('') : `${characters.slice(0, 497).join('').trimEnd()}...`;
};

const headers = () => ({
    'Content-Type': 'application/json',
    ...(env.localLlmApiKey ? { Authorization: `Bearer ${env.localLlmApiKey}` } : {})
});

const requestCommentary = async (analysis: PracticeAnalysis, locale: Locale, fallback: string): Promise<CommentaryResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.localLlmTimeoutMs);
    const startedAt = Date.now();
    try {
        const prompt = buildLlmPrompt(analysis, locale);
        const response = await fetch(`${env.localLlmBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                model: env.localLlmModel,
                messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
                temperature: 0.6,
                max_tokens: 300
            }),
            signal: controller.signal,
            redirect: 'error'
        });
        if (!response.ok) throw new Error(`http_${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error('empty_content');
        console.log(`[analysis-llm] model=${env.localLlmModel} period=${analysis.periodDays} locale=${locale} duration=${Date.now() - startedAt}ms status=success`);
        return { text: trimCommentary(content), source: 'llm' };
    } catch (error) {
        const reason = error instanceof Error ? error.name === 'AbortError' ? 'timeout' : error.message : 'unknown';
        console.error(`[analysis-llm] model=${env.localLlmModel} period=${analysis.periodDays} locale=${locale} duration=${Date.now() - startedAt}ms status=fallback reason=${reason}`);
        return { text: fallback, source: 'fallback', reason: 'upstream_error' };
    } finally {
        clearTimeout(timeout);
    }
};

export const generateAnalysisCommentary = async (waId: string, analysis: PracticeAnalysis, locale: Locale): Promise<CommentaryResult> => {
    const fallback = buildRuleBasedCommentary(analysis, locale);
    if (!env.localLlmEnabled) return { text: fallback, source: 'fallback', reason: 'disabled' };
    if (analysis.totalCheckinDays < env.localLlmMinCheckins || !analysis.groupMethods.length) {
        return { text: fallback, source: 'fallback', reason: 'insufficient_data' };
    }
    if (missingLocalLlmConfiguration().length || !isPrivateLlmUrl(env.localLlmBaseUrl)) {
        return { text: fallback, source: 'fallback', reason: 'invalid_configuration' };
    }
    const prompt = buildLlmPrompt(analysis, locale);
    const key = crypto.createHash('sha256').update(JSON.stringify({ promptVersion: PROMPT_VERSION, model: env.localLlmModel, locale, prompt })).digest('hex');
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.result;
    if (cached) cache.delete(key);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;
    const userWindowKey = crypto.createHash('sha256').update(`${waId}:${analysis.periodDays}`).digest('hex');
    const previous = lastRequest.get(userWindowKey) || 0;
    if (Date.now() - previous < COOLDOWN_MS) return { text: fallback, source: 'fallback', reason: 'rate_limited' };
    const requestedAt = Date.now();
    lastRequest.set(userWindowKey, requestedAt);
    const cleanup = setTimeout(() => {
        if (lastRequest.get(userWindowKey) === requestedAt) lastRequest.delete(userWindowKey);
    }, COOLDOWN_MS);
    cleanup.unref();
    const request = requestCommentary(analysis, locale, fallback).then((result) => {
        if (cache.size >= 1000) cache.delete(cache.keys().next().value as string);
        cache.set(key, { result, expiresAt: Date.now() + (result.source === 'llm' ? SUCCESS_TTL_MS : FAILURE_TTL_MS) });
        return result;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
};

const requestLocalLlmHealth = async (): Promise<LlmHealth> => {
    const checkedAt = new Date().toISOString();
    if (!env.localLlmEnabled) return { enabled: false, ok: true, checkedAt, status: 'disabled' };
    if (missingLocalLlmConfiguration().length) return { enabled: true, ok: false, checkedAt, status: 'missing_configuration' };
    if (!isPrivateLlmUrl(env.localLlmBaseUrl)) return { enabled: true, ok: false, checkedAt, status: 'invalid_url' };
    const startedAt = Date.now();
    let result: LlmHealth;
    try {
        const response = await fetch(`${env.localLlmBaseUrl}/models`, { headers: headers(), signal: AbortSignal.timeout(Math.min(env.localLlmTimeoutMs, 5000)), redirect: 'error' });
        const body = await response.json() as { data?: Array<{ id?: string }> };
        const found = response.ok && body.data?.some((model) => model.id === env.localLlmModel);
        result = { enabled: true, ok: Boolean(found), checkedAt, status: found ? 'available' : 'model_unavailable', latencyMs: Date.now() - startedAt };
    } catch {
        result = { enabled: true, ok: false, checkedAt, status: 'request_failed', latencyMs: Date.now() - startedAt };
    }
    healthCache = { result, expiresAt: Date.now() + 60_000 };
    return result;
};

export const checkLocalLlm = async (force = false): Promise<LlmHealth> => {
    if (!force && healthCache && healthCache.expiresAt > Date.now()) return healthCache.result;
    if (healthPending) return healthPending;
    healthPending = requestLocalLlmHealth().finally(() => {
        healthPending = undefined;
    });
    return healthPending;
};
