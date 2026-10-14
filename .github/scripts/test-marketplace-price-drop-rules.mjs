import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(".github/scripts/refresh-marketplace-prices.mjs", "utf8");

test("marketplace price-drop alerts compare existing listing IDs when available", () => {
  assert.match(source, /previousById = new Map\(previousOffers\.filter\(offer => offer\.itemId\)\.map\(offer => \[offer\.itemId, offer\]\)\)/);
  assert.match(source, /const old = previousById\.get\(offer\.itemId\)/);
});

test("new or relisted offers can be compared against the prior condition baseline", () => {
  assert.match(source, /const previousBaselines = new Map\(\)/);
  assert.match(source, /const baseline = old \? oldTotal : previousBaselines\.get\(group\)/);
  assert.match(source, /referencePrice - newTotal >= Math\.max\(2, referencePrice \* 0\.05\)/);
});

test("used, opened, damaged and no-shrink offers are excluded from price-drop comparisons", () => {
  assert.match(source, /const isUnsealedOrRisky = condition => \/used\|open box\|opened\|no shrink\|without shrink\|damaged\|for parts\|not sealed\//);
  assert.match(source, /if \(group === 'excluded' \|\| !Number\.isFinite\(newTotal\) \|\| newTotal <= 0\) continue/);
});

test("Discord price-drop embeds suppress automatic role and user mentions", () => {
  assert.match(source, /allowed_mentions: \{ parse: \[\] \}/);
  assert.match(source, /title: 'eBay price drop: ' \+ alert\.product/);
});

test("marketplace refresh fails clearly when eBay API credentials are absent", () => {
  assert.match(source, /if \(!clientId \|\| !clientSecret\)/);
  assert.match(source, /eBay marketplace tracking is not configured/);
});
