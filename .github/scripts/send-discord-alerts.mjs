import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const stockWebhookUrl = process.env.DISCORD_STOCK_WEBHOOK_URL || webhookUrl;
const priceDropWebhookUrl = process.env.DISCORD_PRICE_DROP_WEBHOOK_URL || webhookUrl;
const releaseWebhookUrl = process.env.DISCORD_RELEASE_WEBHOOK_URL || webhookUrl;
const beforeSha = process.env.BEFORE_SHA;
const stockAlertRoleId = process.env.DISCORD_STOCK_ALERT_ROLE_ID;
const priceDropRoleId = process.env.DISCORD_PRICE_DROP_ROLE_ID;
const releaseAlertRoleId = process.env.DISCORD_RELEASE_ALERT_ROLE_ID;

if (stockAlertRoleId && !/^\d{17,20}$/.test(stockAlertRoleId)) {
  throw new Error('DISCORD_STOCK_ALERT_ROLE_ID must be a Discord role ID made of 17–20 digits.');
}
if (priceDropRoleId && !/^\d{17,20}$/.test(priceDropRoleId)) {
  throw new Error('DISCORD_PRICE_DROP_ROLE_ID must be a Discord role ID made of 17–20 digits.');
}

if (!webhookUrl) {
  throw new Error('Add the DISCORD_WEBHOOK_URL repository secret before enabling Discord alerts.');
}

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
validateWebhook(webhookUrl, 'DISCORD_WEBHOOK_URL');
validateWebhook(stockWebhookUrl, 'DISCORD_STOCK_WEBHOOK_URL');
validateWebhook(priceDropWebhookUrl, 'DISCORD_PRICE_DROP_WEBHOOK_URL');
validateWebhook(releaseWebhookUrl, 'DISCORD_RELEASE_WEBHOOK_URL');

if (!beforeSha) {
  throw new Error('The previous commit could not be identified; no alert was sent.');
}

const previousJson = execFileSync('git', ['show', `${beforeSha}:products.json`], { encoding: 'utf8' });
const [previousProducts, currentProducts] = await Promise.all([
  Promise.resolve(JSON.parse(previousJson)),
  readFile(new URL('../../products.json', import.meta.url), 'utf8').then(JSON.parse),
]);

const productKey = (product) => [product.name, product.set, product.language, product.type].join('|');
const previousByKey = new Map(previousProducts.map((product) => [productKey(product), product]));
const alerts = [];
const todayUtc = new Date();
todayUtc.setUTCHours(0, 0, 0, 0);
const hasFreshCheck = (offer) => {
  // A recent date alone is not proof of stock. Only the monitor's explicit
  // verification marker can qualify an offer for stock/price alerts.
  if (offer?.stockCheckStatus !== 'verified' || !offer?.checkedAt) return false;
  const checkedDate = new Date(`${offer.checkedAt}T00:00:00Z`);
  const ageDays = (todayUtc - checkedDate) / 86400000;
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
      Number(oldOffer.price) > Number(offer.price)
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

if (alerts.length === 0) {
  console.log('No new products, restocks, pre-orders, or price drops to report.');
  process.exit(0);
}

// Keep stock pings, price-drop pings, and informational updates in separate
// messages so one category can never accidentally ping another category's role.
const groups = [
  {
    roleId: stockAlertRoleId,
    webhookUrl: stockWebhookUrl,
    message: 'New stock or pre-order alert(s) just landed.',
    items: alerts.filter((alert) => alert.pingMembers),
  },
  {
    roleId: priceDropRoleId,
    webhookUrl: priceDropWebhookUrl,
    message: 'A verified price drop just landed.',
    items: alerts.filter((alert) => alert.pingPriceDrops),
  },
  {
    roleId: releaseAlertRoleId,
    webhookUrl: releaseWebhookUrl,
    message: 'A new Pokémon release is being tracked.',
    items: alerts.filter((alert) => alert.title.startsWith('New release tracked:')),
  },
  {
    roleId: null,
    webhookUrl,
    message: '',
    items: alerts.filter((alert) =>
      !alert.pingMembers &&
      !alert.pingPriceDrops &&
      !alert.title.startsWith('New release tracked:')
    ),
  },
].filter((group) => group.items.length > 0);

for (const group of groups) {
  for (let index = 0; index < group.items.length; index += 10) {
    const shouldPingRole = Boolean(group.roleId);
    const response = await fetch(group.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'Shaqs Poke Stock',
        content: shouldPingRole ? `<@&${group.roleId}> ${group.message}` : undefined,
        allowed_mentions: {
          parse: [],
          roles: shouldPingRole ? [group.roleId] : [],
        },
        embeds: group.items.slice(index, index + 10).map((alert) => ({
          title: alert.title,
          description: alert.description || undefined,
          url: alert.url || undefined,
          color: alert.color,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord rejected an alert message (HTTP ${response.status}).`);
    }
  }
}

console.log(`Sent ${alerts.length} product alert(s) to Discord.`);
