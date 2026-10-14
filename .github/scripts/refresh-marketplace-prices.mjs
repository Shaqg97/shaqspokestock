import { readFile, writeFile } from 'node:fs/promises';

const catalogueUrl = new URL('../../products.json', import.meta.url);
const snapshotUrl = new URL('../../marketplace-prices.json', import.meta.url);
const clientId = process.env.EBAY_CLIENT_ID;
const clientSecret = process.env.EBAY_CLIENT_SECRET;
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!clientId || !clientSecret) {
  throw new Error('eBay marketplace tracking is not configured. Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET as repository Actions secrets; the refresh is stopping so the workflow cannot report a false success.');
}

const products = JSON.parse(await readFile(catalogueUrl, 'utf8'));
let previousSnapshot = { products: [] };
try {
  previousSnapshot = JSON.parse(await readFile(snapshotUrl, 'utf8'));
} catch {
  // A first run starts with an empty history.
}

const tokenResponse = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
  method: 'POST',
  headers: {
    authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    'content-type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  }),
  signal: AbortSignal.timeout(20000),
});
if (!tokenResponse.ok) {
  let oauthError = '';
  try {
    const errorData = await tokenResponse.json();
    oauthError = [errorData.error, errorData.error_description].filter(value => typeof value === 'string' && value.trim()).join(': ');
  } catch {
    // Keep the failure safe and concise if eBay does not return JSON.
  }
  throw new Error('eBay OAuth token request failed with HTTP ' + tokenResponse.status + (oauthError ? ' (' + oauthError + ')' : '') + '. Check the eBay application credentials and production API access.');
}
const tokenData = await tokenResponse.json();
if (!tokenData.access_token) throw new Error('eBay OAuth response did not include an access token.');

const previousByKey = new Map((previousSnapshot.products || []).map(item => [item.key, item]));
const snapshots = [];
const warnings = [];
const alerts = [];
const today = new Date().toISOString();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalise = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const stopWords = new Set(['pokemon', 'pokémon', 'tcg', 'the', 'and', 'for', 'with', 'sealed', 'japanese', 'english', 'mega', 'evolution']);
const excludedTerms = ['proxy', 'custom card', 'digital code', 'empty box', 'box only', 'case only', 'single card', 'graded card', 'psa 10', 'cgc 10', 'orica', 'fan made'];

function productKey(product) {
  return [product.name, product.set, product.language, product.type].join('|');
}
function coreTokens(product) {
  return normalise(product.name + ' ' + product.set)
    .split(' ')
    .filter(token => token.length > 2 && !stopWords.has(token));
}
function scoreListing(product, title) {
  const normalTitle = normalise(title);
  if (excludedTerms.some(term => normalTitle.includes(normalise(term)))) return 0;

  const type = normalise(product.type);
  // Enforce product type before scoring the name/set. A booster bundle must
  // never be presented as a booster box, and multi-pack lots must not look
  // like the price of one loose pack.
  if (type === 'booster box') {
    if (/\b(booster bundle|booster pack|booster packs|etb|elite trainer box|collection box|premium collection|mini tin|booster blister)\b/.test(normalTitle)) return 0;
    if (!/\b(booster box|booster display|display box|36 packs)\b/.test(normalTitle)) return 0;
  } else if (type === 'etb') {
    if (!/\b(etb|elite trainer box)\b/.test(normalTitle)) return 0;
    if (/\b(booster box|booster bundle|booster pack|collection box|battle deck)\b/.test(normalTitle)) return 0;
  } else if (type === 'booster pack') {
    if (!/\b(booster pack|booster packs)\b/.test(normalTitle)) return 0;
    if (/\b(booster box|display box|booster bundle|etb|elite trainer box)\b/.test(normalTitle)) return 0;
    // A multi-pack listing's headline price is not comparable with one pack.
    if (/\b(\d+\s*(?:x|×)\s*(?:booster\s*)?packs?|\d+\s+(?:booster\s+)?packs?|lot of|assorted lot|bundle of)\b/.test(normalTitle)) return 0;
  } else {
    const typeTerms = type.split(' ').filter(Boolean);
    if (typeTerms.length && !typeTerms.some(token => normalTitle.includes(token))) return 0;
  }

  // Prefer specific set identifiers. "Mega Evolution" alone is a broad
  // product family; when the catalogue names a more specific set as well,
  // require that specific set name to appear in the listing.
  const setTokens = normalise(product.set).split(' ').filter(Boolean);
  const isBroadMegaFamily = setTokens.includes('mega') && setTokens.includes('evolution') && setTokens.length > 2;
  const requiredSetTokens = setTokens.filter(token => !isBroadMegaFamily || !['mega', 'evolution'].includes(token));
  if (requiredSetTokens.some(token => !normalTitle.includes(token))) return 0;

  const typeWords = new Set(['booster', 'box', 'etb', 'pack', 'packs', 'elite', 'trainer', 'collection', 'premium', 'mini', 'tin', 'blister', 'display', 'deck', 'figure', 'ultra']);
  const identityTokens = [...new Set(normalise(product.name + ' ' + product.set)
    .split(' ')
    .filter(token => token.length > 2 && !stopWords.has(token) && !typeWords.has(token)))];
  if (!identityTokens.length) return 0;
  const matched = identityTokens.filter(token => normalTitle.includes(token));
  const ratio = matched.length / identityTokens.length;
  if (ratio < (identityTokens.length <= 2 ? 0.75 : 0.7)) return 0;
  return Math.min(100, Math.round(ratio * 100));
}

async function searchListings(product) {
  const query = [product.name, product.set].filter(Boolean).join(' ');
  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '20');
  url.searchParams.set('filter', 'priceCurrency:AUD,deliveryCountry:AU');
  const response = await fetch(url, {
    headers: {
      authorization: 'Bearer ' + tokenData.access_token,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_AU',
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('eBay search failed with HTTP ' + response.status + ' for "' + product.name + '"');
  const data = await response.json();
  return (data.itemSummaries || []).map(item => {
    const score = scoreListing(product, item.title);
    const price = Number(item.price?.value);
    const shipping = (item.shippingOptions || [])
      .map(option => Number(option.shippingCost?.value))
      .filter(value => Number.isFinite(value) && value >= 0);
    const shippingCost = shipping.length ? Math.min(...shipping) : null;
    const currency = item.price?.currency || 'AUD';
    return {
      itemId: item.itemId || null,
      title: item.title || product.name,
      price: Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : null,
      shipping: shippingCost === null ? null : Number(shippingCost.toFixed(2)),
      totalPrice: Number.isFinite(price) && price > 0 && shippingCost !== null ? Number((price + shippingCost).toFixed(2)) : null,
      currency,
      url: item.itemWebUrl || null,
      image: item.image?.imageUrl || null,
      condition: item.condition || null,
      seller: item.seller?.username || null,
      sellerFeedbackPercent: item.seller?.feedbackPercentage || null,
      sellerFeedbackScore: item.seller?.feedbackScore !== null && item.seller?.feedbackScore !== undefined && Number.isFinite(Number(item.seller.feedbackScore)) ? Number(item.seller.feedbackScore) : null,
      availability: item.estimatedAvailabilityStatus || null,
      matchConfidence: score,
    };
  }).filter(item => item.matchConfidence >= 70 && item.price !== null && item.url && item.currency === 'AUD')
    .sort((a, b) => {
      // Prioritise new/sealed listings over used or opened products so the
      // cheapest opened box is not mistaken for the best sealed-product deal.
      const conditionRank = condition => {
        const value = normalise(condition || '');
        if (/new factory sealed|factory sealed|brand new|new sealed/.test(value)) return 0;
        if (value === 'new') return 1;
        if (!value || value === 'not specified') return 2;
        if (/used|open box|opened|no shrink|without shrink|damaged|for parts/.test(value)) return 3;
        return 2;
      };
      const conditionDifference = conditionRank(a.condition) - conditionRank(b.condition);
      if (conditionDifference) return conditionDifference;
      // Compare delivered prices only when both offers include a shipping quote.
      const aHasTotal = a.totalPrice !== null;
      const bHasTotal = b.totalPrice !== null;
      if (aHasTotal !== bHasTotal) return aHasTotal ? -1 : 1;
      const aPrice = aHasTotal ? a.totalPrice : a.price;
      const bPrice = bHasTotal ? b.totalPrice : b.price;
      return aPrice - bPrice || b.matchConfidence - a.matchConfidence;
    })
    .slice(0, 5);
}

for (const product of products) {
  try {
    const offers = await searchListings(product);
    const key = productKey(product);
    const previous = previousByKey.get(key);
    const previousById = new Map((previous?.offers || []).filter(offer => offer.itemId).map(offer => [offer.itemId, offer]));
    for (const offer of offers) {
      const old = previousById.get(offer.itemId);
      const oldTotal = old?.totalPrice ?? old?.price;
      const newTotal = offer.totalPrice ?? offer.price;
      const oldCondition = normalise(old?.condition || '');
      const newCondition = normalise(offer.condition || '');
      const sameCondition = old && oldCondition === newCondition;
      if (old && sameCondition && !/used|open box|opened|no shrink|without shrink|damaged|for parts/.test(newCondition) && Number.isFinite(oldTotal) && Number.isFinite(newTotal) && oldTotal - newTotal >= Math.max(2, oldTotal * 0.05)) {
        alerts.push({
          product: product.name,
          title: offer.title,
          oldPrice: oldTotal,
          newPrice: newTotal,
          url: offer.url,
        });
      }
    }
    snapshots.push({ key, name: product.name, set: product.set, language: product.language, type: product.type, offers, resultCount: offers.length });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
    const old = previousByKey.get(productKey(product));
    snapshots.push(old || { key: productKey(product), name: product.name, set: product.set, language: product.language, type: product.type, offers: [], resultCount: 0, unavailable: true });
  }
  await pause(350);
}

if (warnings.length) {
  const details = [
    '## eBay marketplace price refresh — NOT PUBLISHED',
    '',
    '- Status: failed safely; the existing marketplace-prices.json was left unchanged.',
    '- Reason: one or more catalogue searches failed, so the snapshot timestamp must not be advanced.',
    '- This prevents older listing data from being presented as freshly checked.',
    '',
    '### Search warnings',
    ...warnings.slice(0, 30).map(warning => '- ' + warning),
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, details + '\n');
  }
  throw new Error('eBay price refresh had ' + warnings.length + ' failed catalogue search(es); existing snapshot preserved to prevent stale prices appearing fresh.');
}

// Keep a compact daily history of the lowest comparable eBay AU offer per
// catalogue product. History is a trend reference, not proof of retailer stock.
const historyByDate = new Map();
for (const point of Array.isArray(previousSnapshot.history) ? previousSnapshot.history : []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(point.date || '')) || !Array.isArray(point.products)) continue;
  historyByDate.set(point.date, {
    date: point.date,
    products: point.products.filter(item => item && typeof item.key === 'string' &&
      (item.lowestPrice === null || (Number.isFinite(Number(item.lowestPrice)) && Number(item.lowestPrice) > 0)) &&
      Number.isInteger(item.offerCount) && item.offerCount >= 0)
  });
}
const historyDate = today.slice(0, 10);
const historyProducts = snapshots.map(product => {
  const comparable = (product.offers || [])
    .map(offer => offer.totalPrice !== null && Number.isFinite(Number(offer.totalPrice)) ? Number(offer.totalPrice) : Number(offer.price))
    .filter(price => Number.isFinite(price) && price > 0);
  // A sealed-only series avoids comparing an opened/used listing with a sealed product.
  // Require a known delivered total for this series so shipping uncertainty does not
  // create a false discount signal.
  const sealedComparable = (product.offers || [])
    .filter(offer => /factory sealed|new sealed|brand new sealed|sealed new|new\/factory sealed/i.test(String(offer.condition || "")))
    .filter(offer => offer.totalPrice !== null && Number.isFinite(Number(offer.totalPrice)) && Number(offer.totalPrice) > 0)
    .map(offer => Number(offer.totalPrice));
  return {
    key: product.key,
    lowestPrice: comparable.length ? Number(Math.min(...comparable).toFixed(2)) : null,
    offerCount: comparable.length,
    lowestSealedPrice: sealedComparable.length ? Number(Math.min(...sealedComparable).toFixed(2)) : null,
    sealedOfferCount: sealedComparable.length,
  };
});
historyByDate.set(historyDate, { date: historyDate, products: historyProducts });
const history = [...historyByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-90);

const snapshot = {
  version: 1,
  source: 'eBay Browse API',
  marketplace: 'EBAY_AU',
  currency: 'AUD',
  checkedAt: today,
  products: snapshots,
  history,
  warnings: warnings.slice(0, 30),
};
await writeFile(snapshotUrl, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

if (webhookUrl && alerts.length) {
  const batches = [];
  for (let index = 0; index < alerts.length; index += 10) batches.push(alerts.slice(index, index + 10));
  for (const batch of batches) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Shaqs Poke Stock',
        allowed_mentions: { parse: [] },
        embeds: batch.map(alert => ({
          title: 'eBay price drop: ' + alert.product,
          description: alert.title + '\nA$' + alert.oldPrice.toFixed(2) + ' → A$' + alert.newPrice.toFixed(2),
          url: alert.url,
          color: 0x57f287,
        })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Discord rejected eBay price alerts with HTTP ' + response.status);
  }
}
for (const warning of warnings) console.warn('eBay search warning: ' + warning);
console.log('Saved eBay listing snapshot for ' + snapshots.length + ' catalogue products; ' + snapshots.reduce((sum, item) => sum + (item.offers || []).length, 0) + ' matching offers; ' + alerts.length + ' price-drop alert(s); ' + warnings.length + ' search warning(s).');
