import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
const beforeSha = process.env.BEFORE_SHA;

if (!webhookUrl) {
  throw new Error('Add the DISCORD_WEBHOOK_URL repository secret before enabling Discord alerts.');
}

const parsedWebhookUrl = new URL(webhookUrl);
if (
  parsedWebhookUrl.protocol !== 'https:' ||
  !['discord.com', 'discordapp.com'].includes(parsedWebhookUrl.hostname) ||
  !parsedWebhookUrl.pathname.startsWith('/api/webhooks/')
) {
  throw new Error('DISCORD_WEBHOOK_URL must be a Discord webhook HTTPS URL.');
}

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
    if (!oldOffer) {
      if (newStock === 'in stock' || newStock === 'pre-order') {
        alerts.push({
          title: `${newStock === 'pre-order' ? 'New pre-order listing' : 'New in-stock listing'}: ${product.name}`,
          description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
          url: offer.url || product.url,
          color: newStock === 'pre-order' ? 0xfee75c : 0x57f287,
        });
      }
      continue;
    }

    const oldStock = String(oldOffer.stock ?? '').toLowerCase();
    if (oldStock !== 'in stock' && newStock === 'in stock') {
      alerts.push({
        title: `Back in stock: ${product.name}`,
        description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0x57f287,
      });
    } else if (oldStock !== 'pre-order' && newStock === 'pre-order') {
      alerts.push({
        title: `Pre-order available: ${product.name}`,
        description: `${offer.name} · $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0xfee75c,
      });
    } else if (Number(offer.price) > 0 && Number(oldOffer.price) > Number(offer.price)) {
      alerts.push({
        title: `Price drop: ${product.name}`,
        description: `${offer.name} · $${Number(oldOffer.price).toFixed(2)} → $${Number(offer.price).toFixed(2)}`,
        url: offer.url || product.url,
        color: 0x3498db,
      });
    }
  }
}

if (alerts.length === 0) {
  console.log('No new products, restocks, pre-orders, or price drops to report.');
  process.exit(0);
}

for (let index = 0; index < alerts.length; index += 10) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: 'Shaqs Poke Stock',
      allowed_mentions: { parse: [] },
      embeds: alerts.slice(index, index + 10).map((alert) => ({
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

console.log(`Sent ${alerts.length} product alert(s) to Discord.`);
