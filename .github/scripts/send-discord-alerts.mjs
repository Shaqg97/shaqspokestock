import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isMeaningfulPriceDrop } from './monitoring-safety.mjs';

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const beforeSha = process.env.BEFORE_SHA;

const validateWebhook = (value, label) => {
  if (!value) return;
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    !['discord.com', 'discordapp.com'].includes(parsed.hostname) ||
    !parsed.pathname.startsWith('/api/webhooks/')
  ) {
    throw new Error(`${label} must be a Discord webhook HTTPS URL.`);
  }
};

if (!beforeSha) {
  throw new Error('The previous commit could not be identified; no alert was sent.');
}

const previousJson = execFileSync('git', ['show', `${beforeSha}:products.json`], { encoding: 'utf8' });
const [previousProducts, currentProducts, previousSourceData, currentSourceData] = await Promise.all([
  Promise.resolve(JSON.parse(previousJson)),
  readFile(new URL('../../products.json', import.meta.url), 'utf8').then(JSON.parse),
  Promise.resolve(execFileSync('git', ['show', `${beforeSha}:retailer-source-data.json`], { encoding: 'utf8' })).then(JSON.parse).catch(() => ({ observations: [] })),
  readFile(new URL('../../retailer-source-data.json', import.meta.url), 'utf8').then(JSON.parse).catch(() => ({ observations: [] })),
]);

const productKey = (product) => [product.name, product.set, product.language, product.type].join('|');
const previousByKey = new Map(previousProducts.map((product) => [productKey(product), product]));
const alerts = [];
// Catalogue check dates are written in Australia/Sydney local time. Compare
// them to the Sydney calendar date, not the UTC date, to avoid suppressing
// valid alerts around the local/UTC midnight boundary.
const todaySydney = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todaySydneyMs = Date.parse(`${todaySydney}T00:00:00Z`);
const hasFreshCheck = (offer) => {
  // A recent date alone is not proof of stock. Only the monitor's explicit
  // verification marker can qualify an offer for stock/price alerts.
  if (offer?.stockCheckStatus !== 'verified' || !offer?.checkedAt) return false;
  const checkedDate = new Date(`${offer.checkedAt}T00:00:00Z`);
  const ageDays = (todaySydneyMs - checkedDate.getTime()) / 86400000;
  return Number.isFinite(checkedDate.getTime()) && ageDays >= 0 && ageDays <= 1;
};
const knownStockStates = new Set(['in stock', 'sold out', 'pre-order']);

for (const product of currentProducts) {
  const oldProduct = previousByKey.get(productKey(product));
  if (!oldProduct) {
    const upcoming = product.status === 'Upcoming' || product.status === 'Pre-Order';
    alerts.push({
      title: upcoming ? `New release tracked: ${product.name}` : `New product tracked: ${product.name}`,
      description: [product.set, product.releaseDate ? `Release date: ${product.releaseDate}` : null]
        .filter(Boolean)
        .join(' · '),
      url: product.url,
      color: upcoming ? 0xf5a623 : 0x5865f2,
    });
    continue;
  }

  const previousOffers = new Map((oldProduct.retailers ?? []).map((offer) => [offer.name, offer]));
  for (const offer of product.retailers ?? []) {
    const oldOffer = previousOffers.get(offer.name);
    const newStock = String(offer.stock ?? '').toLowerCase();
    const freshCheck = hasFreshCheck(offer);
    if (!oldOffer) {
      if (freshCheck && knownStockStates.has(newStock) && (newStock === 'in stock' || newStock === 'pre-order')) {
        alerts.push({
          title: `${newStock === 'pre-order' ? 'New pre-order listing' : 'New in-stock listing'}: ${product.name}`,
          description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
          url: offer.url || product.url,
          color: newStock === 'pre-order' ? 0xfee75c : 0x57f287,
          pingMembers: true,
        });
      }
      continue;
    }

    const oldStock = String(oldOffer.stock ?? '').toLowerCase();
    // Never announce a restock, pre-order, or price drop from stale/manual data.
    if (!freshCheck || !knownStockStates.has(newStock)) continue;
    if (oldStock === 'sold out' && newStock === 'in stock') {
      alerts.push({
        title: `Back in stock: ${product.name}`,
        description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0x57f287,
        pingMembers: true,
      });
    } else if (oldStock !== 'pre-order' && newStock === 'pre-order') {
      alerts.push({
        title: `Pre-order available: ${product.name}`,
        description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0xfee75c,
        pingMembers: true,
      });
    } else if (
      (newStock === 'in stock' || newStock === 'pre-order') &&
      Number.isFinite(Number(oldOffer.price)) && Number(oldOffer.price) > 0 &&
      Number.isFinite(Number(offer.price)) && Number(offer.price) > 0 &&
      isMeaningfulPriceDrop(oldOffer.price, offer.price)
    ) {
      alerts.push({
        title: `Price drop: ${product.name}`,
        description: `${offer.name} · $${Number(oldOffer.price).toFixed(2)} → $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0x3498db,
        pingPriceDrops: true,
      });
    }
  }
}

// Direct first-party retailer observations are a separate signal from the curated
// catalogue. Alert on verified transitions here so a retailer-page stock change
// cannot be missed when products.json itself did not change.
const previousSourceByKey = new Map((previousSourceData.observations ?? []).map((item) => [item.key, item]));
const sourceObservationIsFresh = (item) => {
  if (item?.fetchStatus !== 'ok' || !item?.checkedAt || !['in stock', 'pre-order', 'out of stock'].includes(item?.availability)) return false;
  const ageMs = Date.now() - Date.parse(item.checkedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
};
for (const observation of currentSourceData.observations ?? []) {
  if (!sourceObservationIsFresh(observation)) continue;
  const previous = previousSourceByKey.get(observation.key);
  const nextStock = String(observation.availability).toLowerCase();
  const oldStock = String(previous?.availability ?? '').toLowerCase();
  const price = Number(observation.price);
  const hasPrice = Number.isFinite(price) && price > 0;
  const itemUrl = observation.url;
  const itemName = observation.product || 'Pokémon TCG product';
  const retailer = observation.retailer || observation.host || 'Australian retailer';
  if ((oldStock === 'out of stock' || oldStock === 'unknown' || !previous) && (nextStock === 'in stock' || nextStock === 'pre-order')) {
    alerts.push({
      title: `${nextStock === 'pre-order' ? 'Direct-page pre-order confirmed' : 'Direct-page stock confirmed'}: ${itemName}`,
      description: `${retailer}${hasPrice ? ` · A${price.toFixed(2)}` : ''} · First-party product page`,
      url: itemUrl,
      color: nextStock === 'pre-order' ? 0xfee75c : 0x57f287,
      pingMembers: true,
    });
  } else if (oldStock === 'in stock' || oldStock === 'pre-order') {
    const oldPrice = Number(previous?.price);
    if (hasPrice && Number.isFinite(oldPrice) && oldPrice > 0 && isMeaningfulPriceDrop(oldPrice, price)) {
      alerts.push({
        title: `Direct-page price drop: ${itemName}`,
        description: `${retailer} · A${oldPrice.toFixed(2)} → A${price.toFixed(2)} · First-party product page`,
        url: itemUrl,
        color: 0x3498db,
        pingPriceDrops: true,
      });
    }
  }
}

if (alerts.length === 0) {
  console.log('No new products, restocks, pre-orders, or price drops to report.');
  process.exit(0);
}

if (!webhookUrl) {
  throw new Error('Add the DISCORD_WEBHOOK_URL repository secret before enabling Discord alerts.');
}
validateWebhook(webhookUrl, 'DISCORD_WEBHOOK_URL');

// One channel handles every notification. Category labels make each ping easy
// to scan, and no role mentions are sent so the channel stays predictable.
const categoryFor = (alert) => {
  if (alert.pingMembers) return '📦 STOCK / RESTOCK';
  if (alert.pingPriceDrops) return '💸 PRICE DROP';
  if (alert.title.startsWith('New release tracked:')) return '🗓️ NEW RELEASE';
  return 'ℹ️ CATALOGUE UPDATE';
};

for (let index = 0; index < alerts.length; index += 10) {
  const batch = alerts.slice(index, index + 10);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'Shaqs Poke Stock',
      content: '🔔 **Shaqs Poke Stock update** — stock, price and release notifications',
      allowed_mentions: { parse: [], roles: [], users: [] },
      embeds: batch.map((alert) => ({
        title: '[' + categoryFor(alert) + '] ' + alert.title,
        description: alert.description || undefined,
        url: alert.url || undefined,
        color: alert.color,
      })),
    }),
  });
  if (!response.ok) throw new Error('Discord rejected an alert message (HTTP ' + response.status + ').');
}

console.log('Sent ' + alerts.length + ' product alert(s) to the single Discord channel.');
