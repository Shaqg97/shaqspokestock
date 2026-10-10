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

function readStructuredProduct(html, itemId) {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];

  for (const match of scripts) {
    try {
      collectProductNodes(JSON.parse(match[1]), nodes);
    } catch {
      // Ignore malformed structured-data blocks and inspect the remaining blocks.
    }
  }

  const candidates = nodes.filter((node) => {
    const sku = String(node.sku ?? node.productID ?? '');
    return !itemId || !sku || sku.toLowerCase() === itemId.toLowerCase();
  });

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
          'user-agent': 'ShaqsPokeStockMonitor/1.0 (+https://github.com/Shagg97/shaqspokestock)',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        skipped.push(`${product.name}: Kmart page returned HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const structured = readStructuredProduct(html, offer.retailerItemId);
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

      offer.checkedAt = today;
    } catch (error) {
      skipped.push(`${product.name}: ${error instanceof Error ? error.message : 'request failed'}`);
    }
  }
}

if (checked === 0) {
  throw new Error('No Kmart listings with valid product URLs were found in products.json.');
}
if (readable === 0) {
  throw new Error('Kmart pages loaded, but no structured price or stock data could be read. Product data was not updated.');
}

await writeFile(productsUrl, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
console.log(`Checked ${checked} Kmart listing(s). ${updates.length} field change(s). ${skipped.length} listing(s) skipped.`);
for (const update of updates) console.log(`Updated: ${update}`);
for (const message of skipped) console.warn(`Skipped: ${message}`);
