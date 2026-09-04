import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('all lockfile package entries have a valid version', () => {
    const lockfilePath = path.join(process.cwd(), 'package-lock.json');
    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8')) as {
        packages: Record<string, { version?: unknown }>;
    };
    const invalidEntries = Object.entries(lockfile.packages)
        .filter(([packagePath, entry]) => packagePath && (typeof entry.version !== 'string' || !entry.version.trim()))
        .map(([packagePath]) => packagePath);

    assert.deepEqual(invalidEntries, []);
});
