import { readFile } from 'node:fs/promises';

const fileUrl = new URL('../../products.json', import.meta.url);
const products = JSON.parse(await readFile(fileUrl, 'utf8'));
const sourceData = JSON.parse(await readFile(new URL('../../retailer-source-data.json', import.meta.url), 'utf8'));
const issues = [];
let offers = 0;
let withIds = 0;
let withChecks = 0;
let missingImages = 0;
let zeroPrices = 0;
let missingOfferUrls = 0;
let productsMissingUrls = 0;
let productsWithoutOffers = 0;
let productsWithoutCheckDates = 0;
let staleChecks = 0;
let verifiedOffers = 0;
let freshVerifiedOffers = 0;
let staleVerifiedOffers = 0;
let invalidImageUrls = 0;
const todaySydney = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const todaySydneyMs = Date.parse(`${todaySydney}T00:00:00Z`);

for (const [index, product] of products.entries()) {
  if (!product.name || !product.language || !product.type) {
    issues.push(`Product #${index + 1} is missing a name, language, or type.`);
  }
  if (!product.image) missingImages += 1;
  else {
    try {
      if (new URL(product.image).protocol !== 'https:') invalidImageUrls += 1;
    } catch {
      invalidImageUrls += 1;
    }
  }
  if (!product.url) productsMissingUrls += 1;
  if (!Array.isArray(product.retailers) || product.retailers.length === 0) productsWithoutOffers += 1;
  if (!(product.retailers ?? []).some(offer => offer.checkedAt)) productsWithoutCheckDates += 1;
  for (const offer of product.retailers ?? []) {
    offers += 1;
    if (offer.retailerItemId) withIds += 1;
    if (offer.checkedAt) {
      withChecks += 1;
      const checkedDate = new Date(`${offer.checkedAt}T00:00:00Z`);
      const ageDays = (todaySydneyMs - checkedDate.getTime()) / 86400000;
      if (!Number.isFinite(checkedDate.getTime()) || ageDays < 0 || ageDays > 3) staleChecks += 1;
      if (offer.stockCheckStatus === 'verified') {
        verifiedOffers += 1;
        if (Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= 1) freshVerifiedOffers += 1;
        else staleVerifiedOffers += 1;
      }
    }
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
  `- Offers with stale or future check dates (older than 3 days): **${staleChecks}**`,
  `- Offers explicitly verified by the priority monitor: **${verifiedOffers}/${offers}**`,
  `- Verified offers with a Sydney-date check today or yesterday: **${freshVerifiedOffers}**`,
  `- Verified offers with stale/future dates: **${staleVerifiedOffers}**`,
  `- Offers without a verification marker: **${offers - verifiedOffers}**`,
  `- Direct-source pages fetched: **${Number(sourceData.successfulFetches || 0)}/${Number(sourceData.observationCount || 0)}**`,
  `- Direct-source pages with explicit price/stock/quantity evidence: **${Number(sourceData.evidenceObservations || 0)}**`,
  `- Direct-source pages blocked/skipped: **${Number(sourceData.blockedOrSkipped || 0)}**`,
  `- Products with invalid image URLs: **${invalidImageUrls}**`,
  `- Products missing an image URL: **${missingImages}/${products.length}**`,
  `- Products missing a primary product URL: **${productsMissingUrls}/${products.length}**`,
  `- Products with no retailer offers: **${productsWithoutOffers}/${products.length}**`,
  `- Products without any offer check date: **${productsWithoutCheckDates}/${products.length}**`,
  `- Offers with zero/unknown price: **${zeroPrices}**`,
  `- Offers missing a retailer URL: **${missingOfferUrls}**`,
  '',
  issues.length ? '### Data errors' : '### Data errors',
  ...(issues.length ? issues.map(issue => `- ❌ ${issue}`) : ['- None found.']),
  '',
  '> A recorded attempt is not the same as a verified stock result. The priority monitor’s explicit verification marker is counted separately. Direct-source HTTP success also does not guarantee that matching product price/stock evidence was found.',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
if (issues.length) process.exitCode = 1;
