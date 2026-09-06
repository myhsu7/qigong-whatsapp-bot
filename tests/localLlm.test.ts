import assert from 'node:assert/strict';
import test from 'node:test';
import type { PracticeAnalysis } from '../src/services/analysis';

const analysis: PracticeAnalysis = {
    periodDays: 30,
    startDate: '2026-08-04',
    endDate: '2026-09-02',
    totalCheckinDays: 5,
    missedDays: 25,
    attendanceRate: 1 / 6,
    currentStreak: 2,
    longestStreak: 3,
    journalDays: 4,
    dataSufficient: true,
    trend: { firstHalfDays: 2, secondHalfDays: 3, delta: 1, direction: 'stable' },
    groupMethods: [{ methodId: 1, methodCode: 'dayan', methodName: 'EnerQi Dayan', matchedDays: 4, attendanceRatio: 0.8, compositionRatio: 0.8 }],
    leafMethods: []
};

test('uses a private LLM with aggregate-only prompts, cache, and safe health output', async () => {
    process.env.LOCAL_LLM_ENABLED = 'true';
    process.env.LOCAL_LLM_BASE_URL = 'http://100.76.80.108:11434/v1';
    process.env.LOCAL_LLM_MODEL = 'test-model';
    process.env.LOCAL_LLM_API_KEY = 'secret-key';
    process.env.LOCAL_LLM_MIN_CHECKINS = '5';
    const originalFetch = globalThis.fetch;
    let completionCalls = 0;
    let modelCalls = 0;
    let requestBody = '';
    try {
        globalThis.fetch = async (input, init) => {
            assert.equal(init?.redirect, 'error');
            if (String(input).endsWith('/models')) {
                modelCalls += 1;
                await new Promise((resolve) => setTimeout(resolve, 5));
                return new Response(JSON.stringify({ data: [{ id: 'test-model' }] }), { status: 200 });
            }
            completionCalls += 1;
            requestBody = String(init?.body || '');
            return new Response(JSON.stringify({ choices: [{ message: { content: 'Keep a steady practice rhythm.' } }] }), { status: 200 });
        };
        const { buildLlmPrompt, checkLocalLlm, generateAnalysisCommentary, isPrivateLlmUrl } = await import('../src/services/localLlm');
        assert.equal(isPrivateLlmUrl('https://api.example.com/v1'), false);
        assert.equal(isPrivateLlmUrl('http://model.local/v1'), false);
        assert.equal(isPrivateLlmUrl('http://fd-public.example/v1'), false);
        assert.equal(isPrivateLlmUrl('http://100.76.80.108:11434/v1'), true);
        assert.equal(isPrivateLlmUrl('http://[fd00::1]:11434/v1'), true);
        const prompt = JSON.stringify(buildLlmPrompt(analysis, 'en'));
        for (const sensitive of ['wa-id', 'private journal', 'body feeling', '2026-09-02']) assert.equal(prompt.includes(sensitive), false);
        const insufficient = await generateAnalysisCommentary('wa-id', { ...analysis, totalCheckinDays: 4 }, 'en');
        assert.equal(insufficient.reason, 'insufficient_data');
        assert.equal(completionCalls, 0);
        const first = await generateAnalysisCommentary('wa-id', analysis, 'en');
        const second = await generateAnalysisCommentary('wa-id', analysis, 'en');
        assert.equal(first.source, 'llm');
        assert.deepEqual(second, first);
        assert.equal(completionCalls, 1);
        assert.equal(requestBody.includes('secret-key'), false);
        const [health, concurrentHealth] = await Promise.all([checkLocalLlm(true), checkLocalLlm(true)]);
        assert.equal(health.ok, true);
        assert.deepEqual(concurrentHealth, health);
        assert.equal(modelCalls, 1);
        assert.equal(JSON.stringify(health).includes('secret-key'), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
