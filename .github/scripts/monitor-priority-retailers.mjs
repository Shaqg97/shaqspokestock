import { readFile, writeFile } from 'node:fs/promises';
import { matchesProductTitle, shouldCheckOffer } from './retailer-product-match.mjs';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monitored = [];
const skipped = [];
let changed = false;
const supportedHosts = new Set(['jbhifi.com.au', 'target.com.au']);

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
      // Ignore malformed or templated JSON-LD blocks.
    }
  }
  for (const product of candidates) {
    const offerList = Array.isArray(product.offers) ? product.offers : [product.offers];
    for (const offer of offerList) {
      if (!offer || typeof offer !== 'object') continue;
      const stock = getStock(offer.availability);
      const price = Number(offer.price ?? offer.lowPrice);
      const currency = String(offer.priceCurrency ?? offer.priceSpecification?.priceCurrency ?? 'AUD').toUpperCase();
      if (stock && Number.isFinite(price) && price > 0 && currency === 'AUD' && typeof product.name === 'string') {
        return { title: product.name, stock, price: Math.round(price * 100) / 100 };
      }
    }
  }
  return null;
}

async function checkOffer(product, offer) {
  if (!offer.url) return;
  let url;
  try {
    url = new URL(offer.url);
  } catch {
    return;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'bigw.com.au') {
    skipped.push(`${product.name} / ${offer.name} — BIG W monitoring paused after repeated timeouts; catalogue entry retained for later review`);
    return;
  }
  if (!supportedHosts.has(host)) return;

  // Check confirmed stock states and explicit pre-order states only.
  // Unknown, location-dependent, and generic "Check Retailer" states remain protected.
  if (!shouldCheckOffer(product.status, offer.stock)) {
    skipped.push(`${product.name} / ${offer.name} — existing state "${offer.stock}" is protected`);
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 (compatible; ShaqsPokeStock/1.0; +https://github.com/Shaqg97/shaqspokestock)',
      },
      // Requests run concurrently to avoid waiting through repeated retailer timeouts one by one.
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      skipped.push(`${product.name} / ${offer.name} — HTTP ${response.status}; left unchanged`);
      return;
    }
    const html = await response.text();
    const live = getProductData(html);
    if (!live) {
      skipped.push(`${product.name} / ${offer.name} — no usable Product/Offer JSON-LD; left unchanged`);
      return;
    }

    const match = matchesProductTitle(product.name, live.title, product.type);
    if (!match.matches) {
      skipped.push(`${product.name} / ${offer.name} — ${match.reason} ("${live.title}"); left unchanged`);
      return;
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

const tasks = [];
for (const product of products) {
  for (const offer of product.retailers ?? []) tasks.push(checkOffer(product, offer));
}
// Keep requests to retailer storefronts conservative instead of firing every URL at once.
const concurrency = 4;
for (let index = 0; index < tasks.length; index += concurrency) {
  await Promise.all(tasks.slice(index, index + concurrency));
  if (index + concurrency < tasks.length) {
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  const summary = [
    '## Priority retailer check summary',
    '',
    `- Sydney date: ${today}`,
    `- Verified offers: ${monitored.length}`,
    `- Offers skipped or not verifiable: ${skipped.length}`,
    '',
    ...(monitored.length ? ['### Verified checks', ...monitored.map((line) => '- ' + line), ''] : []),
    ...(skipped.length ? ['### Left unchanged', ...skipped.map((line) => '- ' + line), ''] : []),
    '> Skipped or blocked pages are not treated as out of stock.'
  ].join('\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
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
