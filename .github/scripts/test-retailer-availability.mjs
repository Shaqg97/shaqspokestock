import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAvailability, hasNotifyOnlyMessage, toRetailerStock } from './retailer-availability.mjs';

test('explicit preorder and presale values are preserved', () => {
  assert.equal(classifyAvailability('https://schema.org/PreOrder'), 'pre-order');
  assert.equal(classifyAvailability('PreSale'), 'pre-order');
});

test('explicit stock values are normalised', () => {
  assert.equal(classifyAvailability('https://schema.org/InStock'), 'in stock');
  assert.equal(classifyAvailability('LimitedAvailability'), 'in stock');
  assert.equal(classifyAvailability('OutOfStock'), 'out of stock');
});

test('OnlineOnly is not treated as evidence of stock', () => {
  assert.equal(classifyAvailability('OnlineOnly'), 'unknown');
  assert.equal(toRetailerStock('OnlineOnly'), null);
});

test('notify-only product page overrides stale structured in-stock evidence', () => {
  const html = '<section><h2>GET NOTIFIED WHEN IT\'S BACK</h2><p>Signing up does not guarantee access to order.</p></section>';
  assert.equal(hasNotifyOnlyMessage(html), true);
  assert.equal(classifyAvailability('InStock', html), 'out of stock');
  assert.equal(toRetailerStock('PreOrder', html), 'Sold Out');
});

test('generic newsletter notifications do not imply product is sold out', () => {
  const html = '<footer>Sign up to get notified about news and special offers.</footer>';
  assert.equal(hasNotifyOnlyMessage(html), false);
  assert.equal(classifyAvailability('InStock', html), 'in stock');
});

test('unknown or incomplete availability remains unknown', () => {
  assert.equal(classifyAvailability(''), 'unknown');
  assert.equal(classifyAvailability('CheckStore'), 'unknown');
});
