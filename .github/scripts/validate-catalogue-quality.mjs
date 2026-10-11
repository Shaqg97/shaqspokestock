import { readFile } from 'node:fs/promises';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const issues = [];
let offers = 0;
let withIds = 0;
let withChecks = 0;
let missingImages = 0;
let zeroPrices = 0;
let missingOfferUrls = 0;

for (const [index, product] of products.entries()) {
  if (!product.name || !product.language || !product.type) {
    issues.push(`Product #${index + 1} is missing a name, language, or type.`);
  }
  if (!product.image) missingImages += 1;
  for (const offer of product.retailers ?? []) {
    offers += 1;
    if (offer.retailerItemId) withIds += 1;
    if (offer.checkedAt) withChecks += 1;
    if (!(Number(offer.price) > 0)) zeroPrices += 1;
    if (!offer.url) missingOfferUrls += 1;
    if (offer.url) {
      try {
        const url = new URL(offer.url);
        if (url.protocol !== 'https:') issues.push(`${product.name} / ${offer.name}: retailer URL is not HTTPS.`);
      } catch {
        issues.push(`${product.name} / ${offer.name}: invalid retailer URL.`);
      }
    }
  }
}

const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
const lines = [
  '## Catalogue quality report',
  '',
  `- Products tracked: **${products.length}**`,
  `- Retailer offers: **${offers}**`,
  `- Offers with retailer item IDs: **${withIds}/${offers} (${pct(withIds, offers)}%)**`,
  `- Offers with a recorded check date: **${withChecks}/${offers} (${pct(withChecks, offers)}%)**`,
  `- Products missing an image URL: **${missingImages}/${products.length}**`,
  `- Offers with zero/unknown price: **${zeroPrices}**`,
  `- Offers missing a retailer URL: **${missingOfferUrls}**`,
  '',
  issues.length ? '### Data errors' : '### Data errors',
  ...(issues.length ? issues.map(issue => `- ❌ ${issue}`) : ['- None found.']),
  '',
  '> A recorded check date means a check was recorded, not that the retailer currently confirms stock. Never treat an old date as live availability.',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
if (issues.length) process.exitCode = 1;
