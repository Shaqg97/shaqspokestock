import { readFile, writeFile } from 'node:fs/promises';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const monitored = [];
const skipped = [];
let changed = false;

// Only probe known retailer domains. A successful response is still not enough:
// the endpoint must contain usable Shopify data and a matching product title.
const supportedHosts = new Set([
  'gameology.com.au',
  'pokebox.com.au',
  'gdgames.com.au',
  'pocketgames.com.au',
  'rnrhobbies.com.au',
  'tcgroupau.com.au',
  'sealedvault.com.au',
  'pokesource.com.au',
  'thecardspot.com.au',
  'theboosterbear.com.au',
  'lightofcards.com.au',
  'yotcorp.com.au',
  'goodgames.com.au',
]);

const normalize = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean);
const generic = new Set(['pokemon', 'pokémon', 'tcg', 'trading', 'card', 'cards', 'booster', 'box', 'pack', 'packs', 'japanese', 'english', 'sealed', 'the', 'and', 'for', 'with', 'evolution']);
const meaningful = (value) => normalize(value).filter((word) => word.length > 2 && !generic.has(word));

async function checkOffer(product, offer) {
  if (!offer.url) return;
  let url;
  try {
    url = new URL(offer.url);
  } catch {
    return;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!supportedHosts.has(host) || !/^\/products\/[^/]+\/?$/.test(url.pathname)) return;

  // Never infer ordinary stock from a pre-order, upcoming release, or unknown state.
  if (!['In Stock', 'Sold Out'].includes(offer.stock) || ['Upcoming', 'Pre-Order'].includes(product.status)) {
    skipped.push(`${product.name} / ${offer.name} — protected existing state "${offer.stock}"`);
    return;
  }

  const endpoint = new URL(url);
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '.js';
  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent': 'ShaqsPokeStock/1.0 (+https://github.com/Shaqg97/shaqspokestock)',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      skipped.push(`${product.name} / ${offer.name} — HTTP ${response.status}; left unchanged`);
      return;
    }
    const item = await response.json();
    if (!item || typeof item.title !== 'string' || typeof item.available !== 'boolean' || !Number.isFinite(Number(item.price))) {
      skipped.push(`${product.name} / ${offer.name} — no usable Shopify product data; left unchanged`);
      return;
    }

    const expected = [...new Set(meaningful([product.name, product.set, product.type].filter(Boolean).join(' ')))];
    const actual = new Set(meaningful(item.title));
    const overlap = expected.filter((word) => actual.has(word));
    if (expected.length < 2 || overlap.length < 2 || overlap.length / expected.length < 0.5) {
      skipped.push(`${product.name} / ${offer.name} — title mismatch ("${item.title}"); left unchanged`);
      return;
    }

    let selected = item;
    const variants = Array.isArray(item.variants) ? item.variants : [];
    if (variants.length > 1) {
      const type = String(product.type ?? '').toLowerCase();
      const variantMatches = (variant) => {
        const title = String(variant.title ?? '').toLowerCase();
        if (type.includes('booster box')) return /box/.test(title) && !/pack only|booster pack/.test(title);
        if (type.includes('booster pack')) return /pack/.test(title) && !/box/.test(title);
        if (type.includes('mini tin')) return /tin/.test(title);
        if (type.includes('portfolio')) return /portfolio/.test(title);
        if (type.includes('etb') || type.includes('trainer box')) return /trainer box|etb/.test(title);
        if (type.includes('bundle')) return /bundle/.test(title);
        if (type.includes('blister')) return /blister/.test(title);
        return false;
      };
      const matches = variants.filter(variantMatches);
      if (matches.length !== 1) {
        skipped.push(`${product.name} / ${offer.name} — multiple variants and no unique "${product.type}" match; left unchanged`);
        return;
      }
      selected = matches[0];
    }

    const nextStock = typeof selected.available === 'boolean'
      ? (selected.available ? 'In Stock' : 'Sold Out')
      : (item.available ? 'In Stock' : 'Sold Out');
    const nextPrice = Math.round((Number(selected.price ?? item.price) / 100) * 100) / 100;
    if (!(nextPrice > 0)) {
      skipped.push(`${product.name} / ${offer.name} — invalid price; left unchanged`);
      return;
    }
    // Guard against variant or page mismatches that produce implausible price jumps.
    const oldPrice = Number(offer.price);
    if (oldPrice > 0 && (nextPrice / oldPrice < 0.5 || nextPrice / oldPrice > 1.5)) {
      skipped.push(`${product.name} / ${offer.name} — price changed from ${oldPrice.toFixed(2)} to ${nextPrice.toFixed(2)} (over 50%); left unchanged for review`);
      return;
    }
    const stockChanged = offer.stock !== nextStock;
    const priceChanged = Number(offer.price) !== nextPrice;
    const metadataChanged = offer.stockCheckStatus !== 'verified' || offer.checkedAt !== today;
    offer.stock = nextStock;
    offer.price = nextPrice;
    offer.stockCheckStatus = 'verified';
    offer.checkedAt = today;
    if (stockChanged || priceChanged || metadataChanged) changed = true;
    monitored.push(`${product.name} / ${offer.name} — ${nextStock}, $${nextPrice.toFixed(2)}${stockChanged ? ' (stock changed)' : ''}${priceChanged ? ' (price changed)' : ''}`);
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
    '## Shopify retailer check summary',
    '',
    `- Sydney date: ${today}`,
    `- Verified offers: ${monitored.length}`,
    `- Offers skipped or not verifiable: ${skipped.length}`,
    '',
    ...(monitored.length ? ['### Verified checks', ...monitored.map((line) => '- ' + line), ''] : []),
    ...(skipped.length ? ['### Left unchanged', ...skipped.map((line) => '- ' + line), ''] : []),
    '> Skipped or blocked pages are not treated as out of stock.'
  ].join('\\n');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\\n');
}

console.log('## Shopify retailer monitor result');
console.log(`- Date: ${today}`);
console.log(`- Product offers successfully checked: ${monitored.length}`);
console.log(`- Offers skipped or not verifiable: ${skipped.length}`);
if (monitored.length) console.log('\n### Verified checks\n' + monitored.map((line) => '- ' + line).join('\n'));
if (skipped.length) console.log('\n### Left unchanged\n' + skipped.map((line) => '- ' + line).join('\n'));
if (changed) {
  await writeFile(fileUrl, JSON.stringify(products, null, 2) + '\n');
  console.log('\nUpdated products.json with verified Shopify retailer checks.');
} else {
  console.log('\nNo catalogue changes were needed.');
}

// One-time correction workflow guard: do not treat ambiguous Shopify variant prices as verified.
// Keep variant-specific pricing conservative when a listing offers multiple product types.
