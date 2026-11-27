import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../../releases.html', import.meta.url), 'utf8');
const products = JSON.parse(await readFile(new URL('../../products.json', import.meta.url), 'utf8'));

test('release calendar does not blindly choose the cheapest catalogue offer', () => {
  assert.match(page, /function isFreshVerified\(o\)/);
  assert.match(page, /stockCheckStatus==="verified"/);
  assert.match(page, /48\*36e5/);
  assert.match(page, /No current checkout verified/);
  assert.doesNotMatch(page, /function bestOffer\(p\)\{return offers\(p\)\[0\]/);
});

test('pre-order filter requires a current retailer offer rather than stale product-level status', () => {
  assert.match(page, /isCheckoutState\(offer\)&&\/pre\.\?order\/i\.test\(String\(offer\.stock\|\|""\)\)&&\(isFreshVerified\(offer\)\|\|isRecent\(offer\)\)/);
  assert.doesNotMatch(page, /state=\(p\.status\|\|"\)\+" "\+\(p\.stock\|\|"\)/);
});

test('new retail listings are clearly marked for manual checkout confirmation', () => {
  const hop = products.find(product => product.name === "Hop's Zacian ex Box");
  const pack = products.find(product => product.name === 'Flowing Fists Sleeved Booster');
  const blister = products.find(product => product.name === 'Flowing Fists Three-Booster Blister');
  assert.ok(hop && pack && blister, 'expected the three newly tracked retail listings');
  assert.equal(hop.retailers.find(offer => offer.name === 'Target')?.stockCheckStatus, 'needs-review');
  assert.equal(pack.releaseDate, '2027-02-06');
  assert.equal(blister.releaseDate, '2027-02-06');
  for (const product of [hop, pack, blister]) {
    for (const offer of product.retailers || []) {
      assert.notEqual(offer.stockCheckStatus, 'verified', 'manual research must not be labelled automated verification');
    }
  }
});
