import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

test('ships achievement and calendar UI with valid inline JavaScript', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'public', 'index.html'), 'utf8');
    assert.match(html, /id="badgeGrid"/);
    assert.match(html, /id="calendarGrid"/);
    assert.match(html, /id="analysisBars"/);
    assert.match(html, /id="generateCommentary"/);
    assert.doesNotMatch(html, /Promise\.all\(\[[^\]]*analysis\/commentary/);
    assert.match(html, /analysisRequestId/);
    assert.match(html, /commentaryRequestId/);
    assert.match(html, /target\.classList\.remove\('error','success'\)/);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1);
    assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});
