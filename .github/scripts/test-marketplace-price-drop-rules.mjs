import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(".github/scripts/refresh-marketplace-prices.mjs", "utf8");

test("marketplace price-drop alerts compare the same listing ID across snapshots", () => {
  assert.match(source, /previousById = new Map\(\(previous\?\.offers \|\| \[\]\)\.filter\(offer => offer\.itemId\)\.map\(offer => \[offer\.itemId, offer\]\)\)/);
  assert.match(source, /const old = previousById\.get\(offer\.itemId\)/);
});

test("alerts require the same condition and a material price reduction", () => {
  assert.match(source, /const sameCondition = old && oldCondition === newCondition/);
  assert.match(source, /oldTotal - newTotal >= Math\.max\(2, oldTotal \* 0\.05\)/);
  assert.match(source, /Number\.isFinite\(oldTotal\) && Number\.isFinite\(newTotal\)/);
});

test("used, opened, damaged and no-shrink offers do not trigger the price-drop rule", () => {
  assert.match(source, /!\/used\|open box\|opened\|no shrink\|without shrink\|damaged\|for parts\//);
});

test("Discord price-drop embeds suppress automatic role and user mentions", () => {
  assert.match(source, /allowed_mentions: \{ parse: \[\] \}/);
  assert.match(source, /title: 'eBay price drop: ' \+ alert\.product/);
});

test("marketplace refresh fails clearly when eBay API credentials are absent", () => {
  assert.match(source, /if \(!clientId \|\| !clientSecret\)/);
  assert.match(source, /eBay marketplace tracking is not configured/);
});
