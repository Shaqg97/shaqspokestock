import { readFile, writeFile } from 'node:fs/promises';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const monitored = [];
const skipped = [];
let changed = false;
const supportedHosts = new Set(['jbhifi.com.au', 'bigw.com.au', 'target.com.au']);

const normalize = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&amp;/g, '&')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);

const generic = new Set(['pokemon', 'pokémon', 'tcg', 'trading', 'card', 'cards', 'booster', 'box', 'pack', 'packs', 'japanese', 'english', 'sealed', 'the', 'and', 'for', 'with', 'mega', 'evolution', 'pokemon']);
const meaningful = (value) => normalize(value).filter((word) => word.length > 2 && !generic.has(word));

function collectProducts(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) collectProducts(item, found);
    return found;
  }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.some((type) => String(type).toLowerCase() === 'product')) found.push(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') collectProducts(child, found);
  }
  return found;
}

function getStock(availability) {
  const value = String(availability ?? '').toLowerCase();
  if (/preorder|presale/.test(value)) return 'Pre-Order';
  if (/outofstock|soldout|discontinued|backorder/.test(value)) return 'Sold Out';
  if (/instock|limitedavailability|onlineonly/.test(value)) return 'In Stock';
  return null;
}

function getProductData(html) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];
  for (const match of blocks) {
    try {
      candidates.push(...collectProducts(JSON.parse(match[1].trim())));
    } catch {
      // Some retailers emit malformed or templated JSON-LD; ignore that block.
    }
  }
  for (const product of candidates) {
    const offerList = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const offer of offerList) {
      if (!offer || typeof offer !== 'object') continue;
      const stock = getStock(offer.availability);
      const price = Number(offer.price ?? offer.lowPrice);
      const currency = String(offer.priceCurrency ?? 'AUD').toUpperCase();
      if (stock && Number.isFinite(price) && price > 0 && currency === 'AUD' && typeof product.name === 'string') {
        return { title: product.name, stock, price: Math.round(price * 100) / 100 };
      }
    }
  }
  return null;
}

for (const product of products) {
  for (const offer of product.retailers ?? []) {
    if (!offer.url) continue;
    let url;
    try {
      url = new URL(offer.url);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!supportedHosts.has(host)) continue;

    // Do not overwrite unknown, in-store-only, pre-order, or upcoming states.
    if (!['In Stock', 'Sold Out'].includes(offer.stock) || ['Upcoming', 'Pre-Order'].includes(product.status)) {
      skipped.push(`${product.name} / ${offer.name} — existing state "${offer.stock}" is protected`);
      continue;
    }

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 (compatible; ShaqsPokeStock/1.0; +https://github.com/Shaqg97/shaqspokestock)',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        skipped.push(`${product.name} / ${offer.name} — HTTP ${response.status}; left unchanged`);
        continue;
      }
      const html = await response.text();
      const live = getProductData(html);
      if (!live) {
        skipped.push(`${product.name} / ${offer.name} — no usable Product/Offer JSON-LD; left unchanged`);
        continue;
      }

      const expected = meaningful(product.name);
      const actual = new Set(meaningful(live.title));
      const overlap = expected.filter((word) => actual.has(word));
      if (expected.length < 2 || overlap.length < 2 || overlap.length / expected.length < 0.5) {
        skipped.push(`${product.name} / ${offer.name} — title mismatch ("${live.title}"); left unchanged`);
        continue;
      }

      const stockChanged = offer.stock !== live.stock;
      const priceChanged = Number(offer.price) !== live.price;
      const metadataChanged = offer.stockCheckStatus !== 'verified' || offer.checkedAt !== today;
      offer.stock = live.stock;
      offer.price = live.price;
      offer.stockCheckStatus = 'verified';
      offer.checkedAt = today;
      if (stockChanged || priceChanged || metadataChanged) changed = true;
      monitored.push(`${product.name} / ${offer.name} — ${live.stock}, $${live.price.toFixed(2)}${stockChanged ? ' (stock changed)' : ''}${priceChanged ? ' (price changed)' : ''}`);
    } catch (error) {
      skipped.push(`${product.name} / ${offer.name} — request failed (${error instanceof Error ? error.message : 'unknown error'}); left unchanged`);
    }
  }
}

console.log('## Priority retailer monitor result');
console.log(`- Date: ${today}`);
console.log(`- Product offers successfully checked: ${monitored.length}`);
console.log(`- Offers skipped or not verifiable: ${skipped.length}`);
if (monitored.length) console.log('\n### Verified checks\n' + monitored.map((line) => '- ' + line).join('\n'));
if (skipped.length) console.log('\n### Left unchanged\n' + skipped.map((line) => '- ' + line).join('\n'));
if (changed) {
  await writeFile(fileUrl, JSON.stringify(products, null, 2) + '\n');
  console.log('\nUpdated products.json with verified priority-retailer checks.');
} else {
  console.log('\nNo catalogue changes were needed.');
}
