import { readFile, writeFile } from 'node:fs/promises';

const productsUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(productsUrl, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function collectProductNodes(value, nodes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectProductNodes(item, nodes);
    return nodes;
  }
  if (!value || typeof value !== 'object') return nodes;

  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.some((type) => String(type).toLowerCase() === 'product') || value.offers) nodes.push(value);
  for (const child of Object.values(value)) collectProductNodes(child, nodes);
  return nodes;
}

function readStructuredProduct(html, itemId, productName) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];

  for (const match of scripts) {
    try {
      collectProductNodes(JSON.parse(match[1]), nodes);
    } catch {
      // Ignore malformed structured-data blocks and inspect the remaining blocks.
    }
  }

  const normalise = (value) => String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const targetName = normalise(productName);
  const skuMatches = nodes.filter((node) => {
    const sku = String(node.sku ?? node.productID ?? '');
    return Boolean(itemId && sku && sku.toLowerCase() === itemId.toLowerCase());
  });
  // Kmart's structured data sometimes omits SKU on the Product node.
  // Only fall back to a name match when the normalised product names agree,
  // avoiding accidental updates from recommendations or related products.
  const nameMatches = nodes.filter((node) => {
    const candidateName = normalise(node.name);
    return targetName && candidateName && (
      candidateName === targetName ||
      candidateName.startsWith(targetName) ||
      targetName.startsWith(candidateName)
    );
  });
  const candidates = skuMatches.length ? skuMatches : nameMatches;

  for (const node of candidates) {
    const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : [];
    for (const offer of offers) {
      const price = Number.parseFloat(String(offer.price ?? offer.lowPrice ?? '').replace(/[^\d.]/g, ''));
      const availability = String(offer.availability ?? '').toLowerCase();
      const stock = availability.includes('preorder') || availability.includes('presale')
        ? 'Pre-Order'
        : availability.includes('instock') || availability.includes('limitedavailability')
          ? 'In Stock'
          : availability.includes('outofstock') || availability.includes('soldout') || availability.includes('discontinued')
            ? 'Sold Out'
            : availability.includes('backorder')
              ? 'Pre-Order'
              : null;

      if ((Number.isFinite(price) && price > 0) || stock) return { price, stock };
    }
  }

  return null;
}

const updates = [];
const skipped = [];
let checked = 0;
let readable = 0;

for (const product of products) {
  for (const offer of product.retailers ?? []) {
    if (offer.name !== 'Kmart' || !offer.url) continue;
    const url = new URL(offer.url);
    if (url.hostname !== 'www.kmart.com.au' && url.hostname !== 'kmart.com.au') {
      skipped.push(`${product.name}: not a Kmart product URL`);
      continue;
    }

    if (checked > 0) await pause(1500);
    checked += 1;

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 (compatible; ShaqsPokeStockMonitor/1.0; +https://github.com/Shaqg97/shaqspokestock)',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        skipped.push(`${product.name}: Kmart page returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const structured = readStructuredProduct(html, offer.retailerItemId, product.name);
      const price = structured?.price;
      const stock = structured?.stock ?? null;

      if (!(Number.isFinite(price) && price > 0) && !stock) {
        skipped.push(`${product.name}: page loaded, but price and stock could not be read safely`);
        continue;
      }
      readable += 1;

      if (Number.isFinite(price) && price > 0 && Number(offer.price) !== price) {
        offer.price = price;
        updates.push(`${product.name}: price updated`);
      }
      if (stock && offer.stock !== stock) {
        offer.stock = stock;
        updates.push(`${product.name}: stock changed to ${stock}`);
      }

      // A check date is recorded as a stock verification date only when the
      // retailer page returned a recognisable availability value.
      if (stock) {
        offer.checkedAt = today;
        offer.stockCheckStatus = 'verified';
      } else {
        offer.stockCheckStatus = 'unverified';
      }
      if (Number.isFinite(price) && price > 0) offer.priceCheckedAt = today;
    } catch (error) {
      skipped.push(`${product.name}: ${error instanceof Error ? error.message : 'request failed'}`);
    }
  }
}

if (checked === 0) {
  throw new Error('No Kmart listings with valid product URLs were found in products.json.');
}
for (const message of skipped) console.warn(`Skipped: ${message}`);
if (readable === 0) {
  console.warn('Kmart monitoring unavailable: no listings returned readable product data. Existing catalogue values were left unchanged; no stock or price changes will be claimed.');
  console.log(`Checked ${checked} Kmart listing(s). 0 readable; ${skipped.length} listing(s) skipped. No product data was changed.`);
  process.exit(0);
}

await writeFile(productsUrl, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
console.log(`Checked ${checked} Kmart listing(s). ${updates.length} field change(s). ${skipped.length} listing(s) skipped.`);
for (const update of updates) console.log(`Updated: ${update}`);
for (const message of skipped) console.warn(`Skipped: ${message}`);
