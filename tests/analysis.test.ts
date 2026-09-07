import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalysisLog, buildPracticeAnalysis, buildRuleBasedCommentary, parseAnalysisWindow } from '../src/services/analysis';

const logs: AnalysisLog[] = [
    {
        id: 1,
        date: '2026-09-01',
        hasPracticeNote: true,
        selections: [
            { leafId: 11, leafCode: 'dayan_chu', leafName: '大雁初', groupId: 1, groupCode: 'dayan', groupName: '大雁功' },
            { leafId: 12, leafCode: 'dayan_gao', leafName: '大雁高', groupId: 1, groupCode: 'dayan', groupName: '大雁功' }
        ]
    },
    {
        id: 2,
        date: '2026-09-02',
        hasPracticeNote: true,
        selections: [{ leafId: 20, leafCode: 'lotus', leafName: '蓮花養心法', groupId: 20, groupCode: 'lotus', groupName: '蓮花養心法' }]
    }
];

test('builds method analysis with same-day group deduplication', () => {
    const analysis = buildPracticeAnalysis(30, '2026-08-04', '2026-09-02', logs);
    assert.equal(analysis.totalCheckinDays, 2);
    assert.equal(analysis.journalDays, 2);
    assert.equal(analysis.groupMethods.find((item) => item.methodCode === 'dayan')?.matchedDays, 1);
    assert.equal(analysis.leafMethods.length, 3);
    assert.equal(analysis.groupMethods.reduce((sum, item) => sum + item.compositionRatio, 0), 1);
    assert.equal(analysis.attendanceRate, 2 / 30);
});

test('validates supported windows and renders all fallback languages', () => {
    assert.equal(parseAnalysisWindow('30'), 30);
    assert.equal(parseAnalysisWindow(90), 90);
    assert.equal(parseAnalysisWindow('60'), null);
    const analysis = buildPracticeAnalysis(30, '2026-08-04', '2026-09-02', logs);
    assert.match(buildRuleBasedCommentary(analysis, 'zh_TW'), /功法/);
    assert.match(buildRuleBasedCommentary(analysis, 'zh_CN'), /功法/);
    assert.match(buildRuleBasedCommentary(analysis, 'en'), /practice/i);
});
