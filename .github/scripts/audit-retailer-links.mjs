import { readFile } from 'node:fs/promises';

const products = JSON.parse(await readFile(new URL('../../products.json', import.meta.url), 'utf8'));
const unique = new Map();
function addUrl(value, retailer, productName) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return;
    const key = url.href;
    if (!unique.has(key)) unique.set(key, { url: key, retailer, products: new Set() });
    unique.get(key).products.add(productName);
  } catch {
    // Invalid URLs are reported by validate-catalogue-quality.mjs.
  }
}
for (const product of products) {
  // Audit the main product-card destination as well as every retailer offer.
  addUrl(product.url, product.store || 'Primary product link', product.name);
  for (const offer of product.retailers ?? []) {
    addUrl(offer.url, offer.name || 'Unknown retailer', product.name);
  }
}

const entries = [...unique.values()];
const results = [];
const byRetailer = new Map();
const retailerLabel = (name) => name
  .replace(/^Kmart \(.*\)$/, 'Kmart')
  .replace(/^BIG W Marketplace$/, 'BIG W Marketplace')
  .replace(/^JB Hi-Fi Marketplace \(.*\)$/, 'JB Hi-Fi Marketplace');
const concurrency = 4;
let cursor = 0;
async function worker() {
  while (cursor < entries.length) {
    const item = entries[cursor++];
    try {
      const response = await fetch(item.url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; ShaqsPokeStockLinkAudit/1.0; +https://github.com/Shaqg97/shaqspokestock)',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(12000),
      });
      let status = response.status;
      if ([403, 405, 429, 500, 501].includes(status)) {
        // Some shops reject HEAD; a small GET can confirm link reachability, not stock.
        const fallback = await fetch(item.url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; ShaqsPokeStockLinkAudit/1.0; +https://github.com/Shaqg97/shaqspokestock)',
            accept: 'text/html,application/xhtml+xml',
            range: 'bytes=0-1023',
          },
          signal: AbortSignal.timeout(12000),
        });
        status = fallback.status;
        await fallback.body?.cancel();
      }
      results.push({ ...item, products: [...item.products], status, ok: status >= 200 && status < 400 });
    } catch (error) {
      results.push({ ...item, products: [...item.products], status: null, error: error instanceof Error ? error.message : 'request failed', ok: false });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));

for (const result of results) {
  const key = retailerLabel(result.retailer || 'Unknown retailer');
  if (!byRetailer.has(key)) byRetailer.set(key, { total: 0, ok: 0, blocked: 0, failed: 0, errors: [] });
  const summary = byRetailer.get(key);
  summary.total += 1;
  if (result.ok) summary.ok += 1;
  else {
    summary.failed += 1;
    summary.errors.push(`${result.status ?? result.error}: ${result.url}`);
  }
  if ([401, 403, 429].includes(result.status)) summary.blocked += 1;
}

const blocked = results.filter(x => [401, 403, 429].includes(x.status));
const failed = results.filter(x => x.status === null || x.status >= 400);
const lines = [
  '## Retailer link reachability audit',
  '',
  `- Unique retailer URLs checked: **${results.length}**`,
  `- Returned successful/redirect status: **${results.length - failed.length}**`,
  `- Failed or blocked requests: **${failed.length}**`,
  `- Access denied / rate limited (401/403/429): **${blocked.length}**`,
  `- Not found (404): **${results.filter(x => x.status === 404).length}**`,
  '',
  '### Results by retailer',
  '',
  '| Retailer | URLs | Reachable | Failed/blocked |',
  '|---|---:|---:|---:|',
  ...[...byRetailer.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, s]) => `| ${name.replaceAll('|', '/')} | ${s.total} | ${s.ok} | ${s.failed} |`),
  '',
  '> This audit checks URL reachability only. HTTP 403 means automated access was denied; HTTP 404 means the tested URL was not found. Neither result confirms product availability, and successful responses do not confirm price or stock.',
  '',
  ...(failed.length ? ['### URLs needing manual review', ...failed.map(x => `- ${x.retailer} — ${x.url} — ${x.status ?? x.error} (products: ${x.products.join(', ')})`)] : ['All audited URLs returned successful/redirect responses.']),
  '',
  '### Monitoring candidates',
  '',
  '- Start price/availability extraction tests with reachable product-specific URLs, beginning with JB Hi-Fi Marketplace, Target, and Gameology.',
  '- Manually verify 404 URLs before updating or removing catalogue offers.',
  '- Treat 403 and 429 as automated-access limitations; do not label those products sold out.',
  '',
  '> Retailer summaries show automated URL reachability only. A successful response is not a stock check; blocked requests require manual review or an approved retailer-supported integration.',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
