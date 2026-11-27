import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const helperSource = await readFile(new URL('retailer-source-evidence.js', root), 'utf8');
const products = JSON.parse(await readFile(new URL('products.json', root), 'utf8'));
const snapshot = JSON.parse(await readFile(new URL('retailer-source-data.json', root), 'utf8'));
const context = { window: {}, Intl, Date, Map, Set, Number, String, Object, Array, Math };
vm.runInNewContext(helperSource, context);
const reconcileProducts = context.window.ShaqsRetailerEvidence.reconcileProducts;
const plain = value => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-11-27T09:00:00.000Z');

test('fresh direct notify-only evidence overrides conflicting catalogue stock on all checkout pages', () => {
  const product = products.find(item => item.name === '30th Celebration Booster Bundle');
  assert.ok(product);
  const reconciled = plain(reconcileProducts([product], snapshot, now))[0];
  const gameology = reconciled.retailers.find(item => item.name === 'Gameology');
  assert.equal(gameology.stock, 'Sold Out');
  assert.equal(gameology.stockCheckStatus, 'needs-review');
  assert.equal(gameology.price, 107, 'unverified catalogue price is retained only as a reference');
  assert.match(gameology.sourceNote, /catalogue reference/);
  assert.equal(gameology.sourceAvailability, 'out of stock');
});

test('direct evidence updates availability but does not silently replace a conflicting price', () => {
  const product = {
    name: 'Example Booster',
    retailers: [{
      name: 'Example Store',
      url: 'https://example.com/example-booster',
      price: 20,
      stock: 'Check Retailer',
      stockCheckStatus: 'needs-review'
    }]
  };
  const data = { observations: [{
    key: 'Example Booster|Example Store|https://example.com/example-booster',
    fetchStatus: 'ok',
    checkedAt: '2026-11-27T08:00:00.000Z',
    availability: 'in stock',
    price: 21
  }] };
  const offer = plain(reconcileProducts([product], data, now))[0].retailers[0];
  assert.equal(offer.stock, 'In Stock');
  assert.equal(offer.price, 20);
  assert.equal(offer.stockCheckStatus, 'needs-review');
  assert.equal(offer.sourceObservedPrice, 21);
  assert.match(offer.sourceNote, /A\$21\.00 versus the A\$20\.00 catalogue reference/);
});

test('matching fresh evidence preserves an existing verified offer without extending its price-check date', () => {
  const product = {
    name: 'Verified Booster',
    retailers: [{
      name: 'Example Store',
      url: 'https://example.com/verified-booster',
      price: 20,
      stock: 'In Stock',
      stockCheckStatus: 'verified',
      checkedAt: '2026-11-26'
    }]
  };
  const data = { observations: [{
    key: 'Verified Booster|Example Store|https://example.com/verified-booster',
    fetchStatus: 'ok',
    checkedAt: '2026-11-27T08:00:00.000Z',
    availability: 'in stock',
    price: 20
  }] };
  const offer = plain(reconcileProducts([product], data, now))[0].retailers[0];
  assert.equal(offer.stockCheckStatus, 'verified');
  assert.equal(offer.checkedAt, '2026-11-26');
  assert.equal(offer.sourceCheckedAt, '2026-11-27T08:00:00.000Z');
});

test('blocked, unknown, stale, future, and non-matching observations never override catalogue offers', () => {
  const product = {
    name: 'Example Booster',
    retailers: [{
      name: 'Example Store',
      url: 'https://example.com/example-booster',
      price: 20,
      stock: 'In Stock',
      stockCheckStatus: 'verified',
      checkedAt: '2026-11-27'
    }]
  };
  const base = {
    key: 'Example Booster|Example Store|https://example.com/example-booster',
    checkedAt: '2026-11-27T08:00:00.000Z',
    availability: 'out of stock',
    price: null
  };
  for (const observation of [
    { ...base, fetchStatus: 'blocked' },
    { ...base, fetchStatus: 'ok', availability: 'unknown' },
    { ...base, fetchStatus: 'ok', checkedAt: '2026-11-25T08:00:00.000Z' },
    { ...base, fetchStatus: 'ok', checkedAt: '2026-11-27T09:10:00.000Z' },
    { ...base, key: 'Different Product|Example Store|https://example.com/example-booster', fetchStatus: 'ok' }
  ]) {
    const offer = plain(reconcileProducts([product], { observations: [observation] }, now))[0].retailers[0];
    assert.equal(offer.stock, 'In Stock');
    assert.equal(offer.stockCheckStatus, 'verified');
  }
});

test('online out-of-stock evidence does not erase an in-store-only listing', () => {
  const product = {
    name: 'In-store Product',
    retailers: [{
      name: 'Target',
      url: 'https://target.com.au/example',
      price: 100,
      stock: 'In Store Only',
      stockCheckStatus: 'needs-review'
    }]
  };
  const data = { observations: [{
    key: 'In-store Product|Target|https://target.com.au/example',
    fetchStatus: 'ok',
    checkedAt: '2026-11-27T08:00:00.000Z',
    availability: 'out of stock',
    price: 100
  }] };
  const offer = plain(reconcileProducts([product], data, now))[0].retailers[0];
  assert.equal(offer.stock, 'In Store Only');
  assert.equal(offer.stockCheckStatus, 'needs-review');
});

test('homepage, Deals, and Releases all load and apply the shared source-evidence layer', async () => {
  for (const page of ['index.html', 'deals.html', 'releases.html']) {
    const html = await readFile(new URL(page, root), 'utf8');
    assert.ok(html.includes('retailer-source-evidence.js'), page + ' must load the shared evidence helper');
    assert.match(html, /ShaqsRetailerEvidence(?:\?\.)?\.reconcileProducts|ShaqsRetailerEvidence\?\.reconcileProducts/, page + ' must reconcile products before rendering');
  }
});
