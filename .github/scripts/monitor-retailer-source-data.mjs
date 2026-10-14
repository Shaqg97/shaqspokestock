import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const products = JSON.parse(await readFile(new URL('products.json', root), 'utf8'));
const outputUrl = new URL('retailer-source-data.json', root);
const previous = await readFile(outputUrl, 'utf8').then(JSON.parse).catch(() => ({ observations: [] }));
const checkedAt = new Date().toISOString();
// Discover retailer hosts from the curated catalogue so coverage expands as
// new Australian retailer offers are added, without hard-coding only the big chains.
const supported = new Set(products.flatMap(product => (product.retailers || []).map(offer => {
  try {
    const url = new URL(offer.url);
    return ['http:', 'https:'].includes(url.protocol) ? url.hostname.toLowerCase().replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}).filter(Boolean)));
const robotsCache = new Map();
const observations = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function hostOf(value) { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function pathAllowed(url, text) {
  const path = new URL(url).pathname + new URL(url).search;
  let active = false;
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === 'user-agent') active = value === '*';
    else if (active && (key === 'disallow' || key === 'allow') && value) rules.push({ key, value });
  }
  const matches = rules.filter(rule => path.startsWith(rule.value)).sort((a, b) => b.value.length - a.value.length);
  return !matches.length || matches[0].key === 'allow';
}
async function canFetch(url) {
  const host = hostOf(url);
  if (!robotsCache.has(host)) robotsCache.set(host, (async () => {
    try {
      const response = await fetch('https://' + host + '/robots.txt', {
        headers: { accept: 'text/plain', 'user-agent': 'ShaqsPokeStock/1.0 (+https://github.com/Shaqg97/shaqspokestock)' },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 404 || response.status === 410) return { allowed: true, text: '' };
      if (!response.ok) return { allowed: false, text: '', reason: 'robots.txt HTTP ' + response.status };
      const text = await response.text();
      return { allowed: pathAllowed(url, text), text, reason: 'Disallowed by robots.txt' };
    } catch { return { allowed: false, text: '', reason: 'robots.txt could not be checked; skipped conservatively' }; }
  })());
  const policy = await robotsCache.get(host);
  return { allowed: policy.allowed && pathAllowed(url, policy.text), reason: policy.reason || 'Disallowed by robots.txt' };
}
function collectObjects(value, result = []) {
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) { for (const item of value) collectObjects(item, result); return result; }
  result.push(value);
  for (const child of Object.values(value)) if (child && typeof child === 'object') collectObjects(child, result);
  return result;
}
function jsonScripts(html) {
  const values = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1].trim();
    if (!body || body.length > 4000000 || !/^[\[{]/.test(body)) continue;
    try { values.push(JSON.parse(body)); } catch {}
  }
  return values;
}
function extractEvidence(html, expectedName) {
  const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\\s+/).filter(Boolean);
  const generic = new Set(['pokemon', 'tcg', 'trading', 'card', 'cards', 'booster', 'box', 'pack', 'packs', 'japanese', 'english', 'sealed', 'the', 'and', 'for', 'with', 'premium', 'collection', 'figure']);
  const expectedTokens = [...new Set(normalize(expectedName).filter(token => token.length > 2 && !generic.has(token)))];
  const objects = jsonScripts(html).flatMap(value => collectObjects(value));
  const roots = objects.filter(object => {
    const name = String(object.name ?? object.productName ?? object.title ?? '');
    const tokens = new Set(normalize(name).filter(token => token.length > 2 && !generic.has(token)));
    const overlap = expectedTokens.filter(token => tokens.has(token)).length;
    return name && overlap >= Math.min(2, expectedTokens.length) && overlap / Math.max(1, expectedTokens.length) >= 0.6;
  });
  const matched = roots.flatMap(root => collectObjects(root)).slice(0, 200);
  let price = null, availability = 'unknown', title = null;
  const quantities = [];
  for (const object of matched) {
    const name = object.name ?? object.productName ?? object.title;
    if (typeof name === 'string' && name.length < 240) title ??= name;
    const currency = String(object.priceCurrency ?? object.currency ?? object.priceSpecification?.priceCurrency ?? 'AUD').toUpperCase();
    const amount = Number(object.price ?? object.lowPrice ?? object.priceSpecification?.price);
    // Reject implausibly large Pokémon TCG prices instead of displaying values that may be minor-unit amounts or unrelated page data.
    if (currency === 'AUD' && Number.isFinite(amount) && amount > 0 && amount < 5000) price ??= Math.round(amount * 100) / 100;
    const raw = String(object.availability ?? object.stockStatus ?? object.inventoryStatus ?? '').toLowerCase();
    if (/pre.?order|presale/.test(raw)) availability = 'pre-order';
    else if (/outofstock|out of stock|sold.?out|discontinued/.test(raw)) { if (availability !== 'pre-order') availability = 'out of stock'; }
    else if (/instock|in stock|limitedavailability|low.?stock/.test(raw) && availability === 'unknown') availability = 'in stock';
    for (const [field, value] of Object.entries(object)) {
      if (!/^(inventoryquantity|quantityavailable|availablequantity|stockquantity|availabletosell|allocationquantity|allocatedquantity|allocation|allocated)$/i.test(field)) continue;
      const quantity = Number(value && typeof value === 'object' ? value.value : value);
      if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000000) continue;
      const context = String(object.storeName ?? object.store?.name ?? object.locationName ?? object.location?.name ?? object.branchName ?? '');
      quantities.push({ kind: /allocat/i.test(field) ? 'allocation' : context ? 'store quantity' : 'inventory quantity', quantity, field, store: context || null });
    }
  }
  return { title, price, availability, quantities: [...new Map(quantities.map(item => [JSON.stringify(item), item])).values()], matchedStructuredObjects: matched.length };
}
const offers = [];
for (const product of products) for (const offer of product.retailers || []) {
  const host = hostOf(offer.url);
  if (offer.url && supported.has(host)) offers.push({ product, offer, host });
}
for (const { product, offer, host } of offers) {
  const key = [product.name, offer.name, offer.url].join('|');
  const base = { key, product: product.name, set: product.set, language: product.language, retailer: offer.name, host, url: offer.url, checkedAt, source: 'retailer first-party product page' };
  const policy = await canFetch(offer.url);
  if (!policy.allowed) {
    observations.push({ ...base, fetchStatus: 'skipped', reason: policy.reason, availability: 'unknown', quantities: [] });
    continue;
  }
  try {
    const response = await fetch(offer.url, {
      headers: { accept: 'text/html,application/xhtml+xml,application/ld+json', 'user-agent': 'ShaqsPokeStock/1.0 (+https://github.com/Shaqg97/shaqspokestock)' },
      redirect: 'follow', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      observations.push({ ...base, fetchStatus: response.status === 403 || response.status === 429 ? 'blocked' : 'http-error', httpStatus: response.status, reason: 'HTTP ' + response.status + '; prior catalogue data preserved', availability: 'unknown', quantities: [] });
    } else {
      const evidence = extractEvidence(await response.text(), product.name);
      observations.push({ ...base, fetchStatus: 'ok', httpStatus: response.status, title: evidence.title, price: evidence.price, availability: evidence.availability, quantities: evidence.quantities, matchedStructuredObjects: evidence.matchedStructuredObjects, reason: evidence.title || evidence.price !== null || evidence.quantities.length ? null : 'No matching structured product evidence; no stock conclusion made' });
    }
  } catch (error) {
    observations.push({ ...base, fetchStatus: 'error', reason: error instanceof Error ? error.message : 'Request failed', availability: 'unknown', quantities: [] });
  }
  await delay(1800);
}
const summary = {
  schemaVersion: 1, checkedAt,
  purpose: 'First-party public product-page observations. Quantity fields appear only when explicitly present in retailer structured data; missing quantities are not zero.',
  sourcePolicy: 'Public retailer pages only; robots.txt respected; blocked pages skipped; no CAPTCHA or access-control bypass.',
  retailerCount: new Set(observations.map(item => item.host)).size,
  catalogueHostCoverage: [...supported].sort(),
  observationCount: observations.length,
  successfulFetches: observations.filter(item => item.fetchStatus === 'ok').length,
  blockedOrSkipped: observations.filter(item => ['blocked', 'skipped'].includes(item.fetchStatus)).length,
  observations,
};
await writeFile(outputUrl, JSON.stringify(summary, null, 2) + '\n');
console.log('Wrote ' + observations.length + ' first-party observations; ' + summary.successfulFetches + ' successful fetches; ' + summary.blockedOrSkipped + ' blocked/skipped. Missing stock and quantity are never converted to zero.');
