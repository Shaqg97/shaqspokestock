import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const snapshot = JSON.parse(fs.readFileSync("marketplace-prices.json", "utf8"));
const products = Array.isArray(snapshot.products) ? snapshot.products : [];
const offers = products.flatMap(product =>
  (Array.isArray(product.offers) ? product.offers : []).map(offer => ({ product, offer }))
);

test("marketplace snapshot has a parseable check timestamp and product list", () => {
  assert.ok(Number.isFinite(Date.parse(snapshot.checkedAt)), "checkedAt must be a valid timestamp");
  assert.ok(Array.isArray(snapshot.products), "products must be an array");
});

test("each marketplace product has a stable key and an offers array", () => {
  for (const product of products) {
    assert.equal(typeof product.key, "string", "product key must be a string");
    assert.ok(product.key.trim().length > 0, "product key must not be blank");
    assert.ok(product.offers === undefined || Array.isArray(product.offers),
      "offers must be an array when present");
  }
});

test("marketplace offers have valid price, URL, condition, currency and match confidence", () => {
  for (const { product, offer } of offers) {
    const label = product.key + " / " + (offer.title || "untitled offer");
    assert.ok(Number.isFinite(Number(offer.price)) && Number(offer.price) > 0,
      "invalid item price: " + label);
    assert.ok(typeof offer.url === "string" && /^https:\/\//i.test(offer.url),
      "offer URL must use HTTPS: " + label);
    assert.ok(typeof offer.condition === "string" && offer.condition.trim(),
      "condition must be explicit: " + label);
    assert.equal(offer.currency, "AUD", "marketplace prices must be AUD: " + label);
    assert.ok(Number.isFinite(Number(offer.matchConfidence)) &&
      Number(offer.matchConfidence) >= 0 && Number(offer.matchConfidence) <= 100,
      "match confidence must be 0-100: " + label);
  }
});

test("known delivered totals and seller feedback values are valid", () => {
  for (const { product, offer } of offers) {
    const label = product.key + " / " + (offer.title || "untitled offer");
    if (offer.totalPrice !== null && offer.totalPrice !== undefined) {
      assert.ok(Number.isFinite(Number(offer.totalPrice)) && Number(offer.totalPrice) > 0,
        "delivered total must be positive when supplied: " + label);
    }
    if (offer.sellerFeedbackPercent !== null && offer.sellerFeedbackPercent !== undefined &&
        String(offer.sellerFeedbackPercent).trim() !== "") {
      const feedback = Number(String(offer.sellerFeedbackPercent).replace("%", "").trim());
      assert.ok(Number.isFinite(feedback) && feedback >= 0 && feedback <= 100,
        "seller feedback percentage must be 0-100: " + label);
    }
    if (offer.sellerFeedbackScore !== null && offer.sellerFeedbackScore !== undefined) {
      assert.ok(Number.isFinite(Number(offer.sellerFeedbackScore)) && Number(offer.sellerFeedbackScore) >= 0,
        "seller feedback count must be non-negative: " + label);
    }
  }
});

console.log("Validated " + products.length + " marketplace products and " + offers.length + " offers.");
