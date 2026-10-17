import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const snapshot = JSON.parse(await readFile(new URL('../../retailer-source-data.json', import.meta.url), 'utf8'));
const observations = snapshot.observations || [];
const validStatuses = new Set(['ok', 'blocked', 'skipped', 'http-error', 'error']);
const evidenceCount = observations.filter(item =>
  (Number.isFinite(Number(item.price)) && Number(item.price) > 0) ||
  item.availability !== 'unknown' ||
  (item.quantities || []).length > 0
).length;

test('source snapshot totals and evidence counts match the observation rows', () => {
  assert.equal(snapshot.observationCount, observations.length);
  assert.equal(snapshot.successfulFetches, observations.filter(item => item.fetchStatus === 'ok').length);
  assert.equal(snapshot.blockedOrSkipped, observations.filter(item => ['blocked', 'skipped'].includes(item.fetchStatus)).length);
  assert.equal(snapshot.evidenceObservations, evidenceCount);
});

test('every observation separates attempt time from successful/evidence timestamps', () => {
  for (const item of observations) {
    assert.ok(validStatuses.has(item.fetchStatus), 'invalid fetch status: ' + item.key);
    assert.ok(item.checkedAt && Number.isFinite(Date.parse(item.checkedAt)), 'invalid checkedAt: ' + item.key);
    assert.equal(item.attemptedAt, item.checkedAt, 'attempt timestamp should match checkedAt: ' + item.key);
    if (item.lastSuccessfulAt) {
      assert.ok(Number.isFinite(Date.parse(item.lastSuccessfulAt)), 'invalid lastSuccessfulAt: ' + item.key);
      assert.ok(Date.parse(item.lastSuccessfulAt) <= Date.parse(item.attemptedAt), 'successful fetch cannot be after attempt: ' + item.key);
    }
    if (item.lastEvidenceAt) {
      assert.ok(Number.isFinite(Date.parse(item.lastEvidenceAt)), 'invalid lastEvidenceAt: ' + item.key);
      assert.ok(item.lastSuccessfulAt, 'evidence requires a successful fetch timestamp: ' + item.key);
      assert.ok(Date.parse(item.lastEvidenceAt) <= Date.parse(item.lastSuccessfulAt), 'evidence cannot be newer than last successful fetch: ' + item.key);
    }
    if (item.fetchStatus === 'ok') assert.equal(item.lastSuccessfulAt, item.checkedAt, 'successful fetch must update lastSuccessfulAt: ' + item.key);
    if (['blocked', 'skipped', 'http-error', 'error'].includes(item.fetchStatus)) {
      assert.equal(item.availability, 'unknown', 'unavailable source must remain unknown: ' + item.key);
      assert.notEqual(item.lastSuccessfulAt, item.checkedAt, 'failed attempt must not become a successful fetch: ' + item.key);
    }
  }
});

test('blocked priority retailers are not presented as verified stock', () => {
  const priority = observations.filter(item => /BIG W|Kmart/i.test(item.retailer));
  assert.ok(priority.length > 0, 'expected BIG W or Kmart observations');
  for (const item of priority) {
    if (['blocked', 'skipped', 'http-error', 'error'].includes(item.fetchStatus)) {
      assert.equal(item.availability, 'unknown', item.retailer + ' / ' + item.product);
    }
  }
});
