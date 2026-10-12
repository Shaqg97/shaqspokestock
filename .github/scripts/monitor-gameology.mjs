import { readFile, writeFile } from 'node:fs/promises';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const monitored = [];
const skipped = [];
let changed = false;

const normalize = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const generic = new Set(['pokemon', 'pokemon', 'tcg', 'trading', 'card', 'cards', 'booster', 'box', 'pack', 'packs', 'japanese', 'english', 'sealed', 'the', 'and', 'for', 'with', 'mega', 'evolution']);
const meaningful = (value) => normalize(value).filter((word) => word.length > 2 && !generic.has(word));

for (const product of products) {
  for (const offer of product.retailers ?? []) {
    if (!offer.url || !/gameology\.com\.au$/i.test(new URL(offer.url).hostname)) continue;
    // Avoid converting pre-orders or upcoming releases into ordinary in-stock listings.
    if (!['In Stock', 'Sold Out'].includes(offer.stock) || product.status === 'Upcoming' || product.status === 'Pre-Order') {
      skipped.push(`${product.name} — existing status is ${offer.stock}; left unchanged`);
      continue;
    }

    const endpoint = new URL(offer.url);
    if (!/^\/products\/[^/]+\/?$/.test(endpoint.pathname)) {
      skipped.push(`${product.name} — not a product-specific Shopify URL`);
      continue;
    }
    endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '.js';

    try {
      const response = await fetch(endpoint, {
        headers: { accept: 'application/json', 'user-agent': 'ShaqsPokeStock/1.0 (+https://github.com/Shaqg97/shaqspokestock)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        skipped.push(`${product.name} — endpoint returned HTTP ${response.status}`);
        continue;
      }
      const item = await response.json();
      if (!item || typeof item.title !== 'string' || typeof item.available !== 'boolean' || !Number.isFinite(Number(item.price))) {
        skipped.push(`${product.name} — product data did not contain the required fields`);
        continue;
      }

      const expected = meaningful(product.name);
      const actual = new Set(meaningful(item.title));
      const overlap = expected.filter((word) => actual.has(word));
      if (expected.length < 2 || overlap.length < 2 || overlap.length / expected.length < 0.5) {
        skipped.push(`${product.name} — title mismatch (${item.title}); left unchanged`);
        continue;
      }

      const nextStock = item.available ? 'In Stock' : 'Sold Out';
      const nextPrice = Number(item.price) / 100;
      if (!(nextPrice > 0)) {
        skipped.push(`${product.name} — invalid price; left unchanged`);
        continue;
      }
      const roundedPrice = Math.round(nextPrice * 100) / 100;
      const stockChanged = offer.stock !== nextStock;
      const priceChanged = Number(offer.price) !== roundedPrice;
      const metadataChanged = offer.stockCheckStatus !== 'verified' || offer.checkedAt !== today;
      offer.stock = nextStock;
      offer.price = roundedPrice;
      offer.stockCheckStatus = 'verified';
      offer.checkedAt = today;
      if (stockChanged || priceChanged || metadataChanged) changed = true;
      monitored.push(`${product.name} — ${nextStock}, $${roundedPrice.toFixed(2)}${stockChanged ? ' (stock changed)' : ''}${priceChanged ? ' (price changed)' : ''}`);
    } catch (error) {
      skipped.push(`${product.name} — request failed (${error instanceof Error ? error.message : 'unknown error'}); left unchanged`);
    }
  }
}

console.log('## Gameology monitor result');
console.log(`- Date: ${today}`);
console.log(`- Product offers successfully checked: ${monitored.length}`);
console.log(`- Offers skipped or not verifiable: ${skipped.length}`);
if (monitored.length) console.log('\n### Verified checks\n' + monitored.map((line) => '- ' + line).join('\n'));
if (skipped.length) console.log('\n### Left unchanged\n' + skipped.map((line) => '- ' + line).join('\n'));

if (changed) {
  await writeFile(fileUrl, JSON.stringify(products, null, 2) + '\n');
  console.log('\nUpdated products.json with verified Gameology checks.');
} else {
  console.log('\nNo catalogue changes were needed.');
}
