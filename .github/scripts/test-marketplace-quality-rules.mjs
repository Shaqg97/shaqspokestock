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
