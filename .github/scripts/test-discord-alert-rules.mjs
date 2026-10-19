import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isMeaningfulPriceDrop, retailerPriceSourcesAgree } from './monitoring-safety.mjs';

const source = await readFile(new URL('./send-discord-alerts.mjs', import.meta.url), 'utf8');
const shopifyMonitor = await readFile(new URL('./monitor-shopify-retailers.mjs', import.meta.url), 'utf8');

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
  assert.ok(source.includes("timeZone: 'Australia/Sydney'"));
  assert.ok(source.includes('todaySydneyMs - checkedDate'));
  assert.ok(!source.includes('todayUtc'));
});

test('price-drop alerts require at least A$2 and 5% savings', () => {
  assert.equal(isMeaningfulPriceDrop(100, 97), false);
  assert.equal(isMeaningfulPriceDrop(100, 95), true);
  assert.equal(isMeaningfulPriceDrop(50, 48), false);
  assert.equal(isMeaningfulPriceDrop(50, 47.5), true);
  assert.equal(isMeaningfulPriceDrop(20, 18), true);
  assert.equal(isMeaningfulPriceDrop(20, 19), false);
  assert.equal(isMeaningfulPriceDrop(100, 101), false);
  assert.equal(isMeaningfulPriceDrop(100, 0), false);
});

test('Shopify endpoint and first-party page data must agree before verification', () => {
  assert.equal(retailerPriceSourcesAgree({ price: 143, stock: 'In Stock' }, { price: 200, stock: 'In Stock' }), false);
  assert.equal(retailerPriceSourcesAgree({ price: 200, stock: 'In Stock' }, { price: 200, stock: 'In Stock' }), true);
  assert.equal(retailerPriceSourcesAgree({ price: 200, stock: 'In Stock' }, { price: 200, stock: 'Sold Out' }), false);
  assert.equal(retailerPriceSourcesAgree({ price: 200, stock: 'In Stock' }, null), false);
});

test('The Card Spot price conflicts are marked for review rather than auto-overwritten', () => {
  assert.ok(shopifyMonitor.includes('getPageProductData(html, product)'));
  assert.ok(shopifyMonitor.includes('retailerPriceSourcesAgree'));
  assert.ok(shopifyMonitor.includes("stockCheckStatus = 'needs-review'"));
});
