import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const products = JSON.parse(fs.readFileSync("products.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const missingImages = products.filter(product => !product.image).map(product => product.name);

test("catalogue image fields are valid HTTPS URLs when supplied", () => {
  for (const product of products) {
    if (!product.image) continue;
    assert.equal(typeof product.image, "string", product.name + ": image must be a URL string");
    let parsed;
    try { parsed = new URL(product.image); }
    catch { assert.fail(product.name + ": image URL is malformed"); }
    assert.equal(parsed.protocol, "https:", product.name + ": image URL must use HTTPS");
    assert.ok(parsed.hostname, product.name + ": image URL must have a host");
  }
});

test("missing or broken images have an accessible branded fallback", () => {
  assert.match(html, /class="(?:image-fallback|product-summary-fallback)"/);
  assert.match(html, /Shaqs Poke Stock/);
  assert.match(html, /Image coming soon/);
  assert.match(html, /onerror="this\.style\.display='none';this\.nextElementSibling\.style\.display='flex';"/);
});

console.log("Checked image URL fields for " + products.length + " products; " +
  missingImages.length + " use the branded fallback: " + (missingImages.join(", ") || "none") + ".");
