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

test("Discord marketplace price-drop embeds use the single channel and suppress all mentions", () => {
  assert.match(source, /const webhookUrl = process\.env\.DISCORD_WEBHOOK_URL/);
  assert.match(source, /allowed_mentions: \{ parse: \[\], roles: \[\], users: \[\] \}/);
  assert.match(source, /content: '💸 \*\*PRICE DROP\*\*/);
  assert.match(source, /title: '\[💸 PRICE DROP\] eBay price drop: ' \+ alert\.product/);
  assert.doesNotMatch(source, /DISCORD_PRICE_DROP_WEBHOOK_URL|DISCORD_PRICE_DROP_ROLE_ID|priceDropRoleId/);
});

test("marketplace refresh fails clearly when eBay API credentials are absent", () => {
  assert.match(source, /if \(!clientId \|\| !clientSecret\)/);
  assert.match(source, /eBay marketplace tracking is not configured/);
});
