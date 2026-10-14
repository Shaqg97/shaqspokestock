import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

test("HTML document closes once and has no appended duplicate content", () => {
  assert.equal(html.split("</html>").length - 1, 1, "index.html must contain one closing html tag");
  assert.ok(html.trimEnd().endsWith("</html>"), "index.html must end at its closing html tag");
});

test("marketplace fallback only uses a recent snapshot", () => {
  assert.match(html, /marketplaceAgeHours >= -1 && marketplaceAgeHours <= 36/);
  assert.match(html, /if \(!snapshotFresh\) return null;/);
});

test("marketplace offer candidates require a usable URL, positive price and confident match", () => {
  assert.match(html, /Number\(offer\.price\) > 0 && offer\.url && Number\(offer\.matchConfidence\) >= 70/);
});

test("factory-sealed condition is ranked ahead of ambiguous new and used listings", () => {
  assert.match(html, /if \(\/new factory sealed\|factory sealed\|brand new\|new sealed\/\.test\(value\)\) return 0;/);
  assert.match(html, /if \(value === "new"\) return 1;/);
  assert.match(html, /if \(\/used\|open box\|opened\|no shrink\|without shrink\|damaged\|for parts\/\.test\(value\)\) return 3;/);
});

test("marketplace ranking puts product-match confidence before seller reputation", () => {
  const start = html.indexOf("const bestMarketplaceOffer = [...marketplaceCandidates].sort");
  assert.notEqual(start, -1, "marketplace fallback comparator exists");
  const end = html.indexOf("})[0] || null;", start);
  assert.notEqual(end, -1, "marketplace fallback comparator closes");
  const comparator = html.slice(start, end);
  const matchIndex = comparator.indexOf("const matchDifference");
  const shippingIndex = comparator.indexOf("const aHasTotal");
  const feedbackIndex = comparator.indexOf("const aFeedbackRaw");
  assert.ok(matchIndex >= 0 && shippingIndex > matchIndex && feedbackIndex > shippingIndex,
    "expected priority: product match, known delivered total, seller feedback");
});

test("zero or missing delivered totals are not treated as known shipping-inclusive prices", () => {
  assert.match(html, /Number\.isFinite\(Number\(a\.totalPrice\)\) && Number\(a\.totalPrice\) > 0/);
  assert.match(html, /Number\.isFinite\(Number\(b\.totalPrice\)\) && Number\(b\.totalPrice\) > 0/);
});

test("marketplace offers are explicitly not verified retailer stock", () => {
  assert.match(html, /it is not retailer stock verification/);
  assert.match(html, /Catalogue-only and marketplace prices never trigger a verified retailer alert/);
});

test("missing or broken product images show branded coming-soon fallback", () => {
  assert.match(html, /class="image-fallback"/);
  assert.match(html, /Shaqs Poke Stock/);
  assert.match(html, /Image coming soon/);
  assert.match(html, /onerror="this\.style\.display='none';this\.nextElementSibling\.style\.display='flex';"/);
});

test("marketplace sort explains when the card price is still a retailer price", () => {
  assert.match(html, /The card can still show a verified retailer price when one is available/);
});

test("marketplace offer display does not treat zero or missing totals as delivered prices", () => {
  assert.match(html, /const hasTotal = offer\.totalPrice !== null && offer\.totalPrice !== undefined &&\s*Number\.isFinite\(Number\(offer\.totalPrice\)\) && Number\(offer\.totalPrice\) > 0/);
});

test("marketplace price targets require a recent snapshot, explicit factory-sealed condition and known delivered total", () => {
  assert.match(html, /function getFreshMarketplaceSealedPrice\(product\)/);
  assert.match(html, /if \(ageHours < -1 \|\| ageHours > 36\) return null;/);
  assert.match(html, /Number\(offer\.matchConfidence\) >= 90 && conditionRankForSort\(offer\.condition\) === 0/);
  assert.match(html, /Number\.isFinite\(Number\(offer\.totalPrice\)\) && Number\(offer\.totalPrice\) > 0/);
});

test("legacy price targets remain verified-retailer alerts unless marketplace source is selected", () => {
  assert.match(html, /return item && item\.source === "marketplace" \? "marketplace" : "retailer";/);
  assert.match(html, /value="retailer"/);
  assert.match(html, /value="marketplace"/);
  assert.match(html, /Sealed eBay AU delivered-total reference/);
  assert.match(html, /marketplace prices are marketplace references, not stock verification/);
});
