import assert from 'node:assert/strict';
import test from 'node:test';
import { getMonthRange } from '../src/services/calendar';
import { UserInputError } from '../src/errors';

test('builds month boundaries including leap years and year changes', () => {
    assert.deepEqual(getMonthRange('2028-02'), {
        month: '2028-02', start: '2028-02-01', endExclusive: '2028-03-01', daysInMonth: 29, firstWeekday: 2
    });
    assert.equal(getMonthRange('2026-12').endExclusive, '2027-01-01');
});

test('rejects malformed calendar months', () => {
    for (const value of ['0000-01', '2026-2', '2026-13', '26-02', '2026-02-01']) {
        assert.throws(() => getMonthRange(value), UserInputError);
    }
});
