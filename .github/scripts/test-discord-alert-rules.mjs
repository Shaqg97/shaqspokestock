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

test('no-alert runs exit before requiring the Discord webhook secret', () => {
  const noAlertExit = source.indexOf('if (alerts.length === 0)');
  const webhookRequirement = source.indexOf('if (!webhookUrl)');
  assert.ok(noAlertExit >= 0 && webhookRequirement > noAlertExit);
});

test('single-channel Discord messages suppress all role and user mentions', () => {
  assert.ok(source.includes('allowed_mentions: { parse: [], roles: [], users: [] }'));
  assert.doesNotMatch(source, /DISCORD_STOCK_ALERT_ROLE_ID|DISCORD_PRICE_DROP_ROLE_ID/);
});

test('all alert categories are routed to one webhook with clear labels', () => {
  assert.match(source, /validateWebhook\(webhookUrl, 'DISCORD_WEBHOOK_URL'\)/);
  assert.match(source, /\['\s*\+ categoryFor\(alert\) \+ '\] '/);
  assert.match(source, /STOCK \/ RESTOCK/);
  assert.match(source, /PRICE DROP/);
  assert.match(source, /NEW RELEASE/);
  assert.match(source, /CATALOGUE UPDATE/);
  assert.doesNotMatch(source, /DISCORD_(?:STOCK|PRICE_DROP|RELEASE)_WEBHOOK_URL/);
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


test('direct retailer snapshot changes trigger Discord workflow runs', async () => {
  const workflow = await readFile(new URL('../workflows/discord-product-alerts.yml', import.meta.url), 'utf8');
  assert.ok(workflow.includes('      - retailer-source-data.json'));
});

test('direct-page stock alerts require a successful fresh first-party observation', () => {
  assert.match(source, /item\?\.fetchStatus !== 'ok'/);
  assert.match(source, /item\?\.checkedAt/);
  assert.match(source, /ageMs <= 24 \* 60 \* 60 \* 1000/);
  assert.match(source, /oldStock === 'out of stock' \|\| oldStock === 'unknown' \|\| !previous/);
  assert.match(source, /nextStock === 'in stock' \|\| nextStock === 'pre-order'/);
});

test('direct-page price drops use the same minimum savings rule as catalogue alerts', () => {
  assert.match(source, /isMeaningfulPriceDrop\(oldPrice, price\)/);
  assert.match(source, /Direct-page price drop:/);
});

test('the general Discord webhook is the only required notification destination', () => {
  assert.match(source, /if \(!webhookUrl\)/);
  assert.match(source, /DISCORD_WEBHOOK_URL/);
  assert.doesNotMatch(source, /DISCORD_(?:STOCK|PRICE_DROP|RELEASE)_WEBHOOK_URL/);
});
