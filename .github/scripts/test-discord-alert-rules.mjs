import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./send-discord-alerts.mjs', import.meta.url), 'utf8');

test('restock alerts require a previously sold-out offer', () => {
  assert.match(source, /if \(oldStock === 'sold out' && newStock === 'in stock'\)/);
  assert.doesNotMatch(source, /if \(oldStock !== 'in stock' && newStock === 'in stock'\)/);
});

test('price-drop alerts require valid positive old and new prices', () => {
  assert.match(source, /Number\.isFinite\(Number\(oldOffer\.price\)\) && Number\(oldOffer\.price\) > 0/);
  assert.match(source, /Number\.isFinite\(Number\(offer\.price\)\) && Number\(offer\.price\) > 0/);
});

test('stock and price alerts require a fresh explicit verification marker', () => {
  assert.match(source, /offer\?\.stockCheckStatus !== 'verified'/);
  assert.match(source, /if \(!freshCheck \|\| !knownStockStates\.has\(newStock\)\) continue/);
});

test('Discord messages suppress all mentions', () => {
  assert.match(source, /allowed_mentions: \{\s*parse: \[\],\s*roles: shouldPingRole \? \[group\.roleId\] : \[\],\s*\}/);
});

test('member pings are optional and restricted to the configured stock-alert role', () => {
  assert.match(source, /DISCORD_STOCK_ALERT_ROLE_ID/);
  assert.match(source, /roles: shouldPingRole \? \[group\.roleId\] : \[\]/);
  assert.match(source, /pingMembers: true/);
  assert.match(source, /alert\.pingMembers/);
});

test('price-drop pings are optional and isolated from stock-alert pings', () => {
  assert.match(source, /DISCORD_PRICE_DROP_ROLE_ID/);
  assert.match(source, /pingPriceDrops: true/);
  assert.match(source, /alert\.pingPriceDrops/);
  assert.match(source, /roles: shouldPingRole \? \[group\.roleId\] : \[\]/);
});


test('freshness checks compare Sydney calendar dates rather than UTC dates', () => {
  assert.match(source, /timeZone: 'Australia\\/Sydney'/);
  assert.match(source, /todaySydneyMs - checkedDate/);
  assert.doesNotMatch(source, /todayUtc/);
});
