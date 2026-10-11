import { readFile } from 'node:fs/promises';

const products = JSON.parse(await readFile(new URL('../../products.json', import.meta.url), 'utf8'));
const unique = new Map();
for (const product of products) {
  for (const offer of product.retailers ?? []) {
    if (!offer.url) continue;
    try {
      const url = new URL(offer.url);
      if (url.protocol !== 'https:') continue;
      const key = url.href;
      if (!unique.has(key)) unique.set(key, { url: key, retailer: offer.name, products: new Set() });
      unique.get(key).products.add(product.name);
    } catch {
      // Invalid URLs are reported by validate-catalogue-quality.mjs.
    }
  }
}

const entries = [...unique.values()];
const results = [];
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

const blocked = results.filter(x => [401, 403, 429].includes(x.status));
const failed = results.filter(x => x.status === null || x.status >= 400);
const lines = [
  '## Retailer link reachability audit',
  '',
  `- Unique retailer URLs checked: **${results.length}**`,
  `- Returned successful/redirect status: **${results.length - failed.length}**`,
  `- Failed or blocked requests: **${failed.length}**`,
  `- Access denied / rate limited (401/403/429): **${blocked.length}**`,
  '',
  '> This audit checks whether URLs respond to automated requests. A successful response does not confirm price or stock; blocked responses do not necessarily mean a link is broken.',
  '',
  ...(failed.length ? ['### URLs needing manual review', ...failed.map(x => `- ${x.retailer} — ${x.url} — ${x.status ?? x.error} (products: ${x.products.join(', ')})`)] : ['All audited URLs returned successful/redirect responses.']),
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
