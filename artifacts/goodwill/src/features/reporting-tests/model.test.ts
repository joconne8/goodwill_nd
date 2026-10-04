import test from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage, formatTimestamp, formatValue, hasEvidence, validatePeriod } from '../reporting/model';

test('inclusive dates reject impossible calendar days and inverted ranges', () => {
  assert.equal(validatePeriod({ startDate: '2026-08-01', endDate: '2026-08-31' }), null);
  assert.equal(validatePeriod({ startDate: '2024-02-29', endDate: '2024-02-29' }), null);
  for (const [startDate, endDate] of [['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'], ['', '2026-08-01'], ['2026-09-01', '2026-08-01']]) {
    assert.ok(validatePeriod({ startDate, endDate }));
  }
});

test('money formatting does not lose a cent at safe integer boundaries', () => {
  assert.equal(formatValue(0, 'usd_cent'), '$0.00');
  assert.equal(formatValue(-1, 'usd_cent'), '-$0.01');
  assert.equal(formatValue(9007199254740991, 'usd_cent'), '$90,071,992,547,409.91');
  assert.equal(formatValue(-9007199254740991, 'usd_cent'), '-$90,071,992,547,409.91');
  assert.equal(formatValue(null, 'count'), 'Unavailable');
  assert.equal(formatValue(1.01, 'usd_cent'), 'Invalid numeric response');
  assert.equal(formatValue(Number.NaN, 'count'), 'Invalid numeric response');
});

test('timestamps preserve Eastern reporting semantics across UTC month boundary', () => {
  assert.match(formatTimestamp('2026-09-01T03:59:59Z'), /8\/31\/2026/);
  assert.match(formatTimestamp('2026-09-01T03:59:59Z'), /Eastern/);
  assert.equal(formatTimestamp(null), 'Not recorded');
});

test('visible API failures retain server reason and do not grant persona access', () => {
  assert.match(errorMessage({ status: 409, data: { code: 'PUBLICATION_CHANGED', message: 'Refresh current revision.' } }), /PUBLICATION_CHANGED/);
  assert.match(errorMessage({ status: 401 }), /authorized session/);
  assert.match(errorMessage({ status: 404 }), /No fixture data/);
});

test('multi-day daily customer evidence is available without manufacturing an aggregate', () => {
  const result = { publicationId: 'synthetic-publication', value: null, points: [{ value: 12 }] } as Parameters<typeof hasEvidence>[0];
  assert.equal(hasEvidence(result), true);
  assert.equal(hasEvidence({ ...result, points: [] }), false);
  assert.equal(hasEvidence({ ...result, publicationId: null, value: 0 }), false);
});