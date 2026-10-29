import test from "node:test";
import assert from "node:assert/strict";
import { matchesProductTitle, inferProductForm } from "./retailer-product-match.mjs";

test("booster box cannot match a single booster pack", () => {
  const result = matchesProductTitle(
    "Delta Reign Booster Box",
    "Pokémon TCG Mega Evolution Delta Reign Single Booster Pack",
    "Booster Box"
  );
  assert.equal(result.matches, false);
  assert.match(result.reason, /product type mismatch/);
});

test("single booster pack cannot match a booster box", () => {
  const result = matchesProductTitle(
    "Delta Reign Single Booster",
    "Pokémon TCG Mega Evolution Delta Reign Booster Display Box 36 Packs",
    "Booster Pack"
  );
  assert.equal(result.matches, false);
});

test("same product and format matches despite retailer boilerplate", () => {
  const result = matchesProductTitle(
    "Delta Reign Booster Box",
    "Pokémon TCG Mega Evolution Delta Reign Booster Display Box 36 Packs Japanese",
    "Booster Box"
  );
  assert.equal(result.matches, true);
});

test("different set names do not match", () => {
  const result = matchesProductTitle(
    "Delta Reign Booster Box",
    "Pokémon TCG Mega Evolution Chaos Rising Booster Box",
    "Booster Box"
  );
  assert.equal(result.matches, false);
});

test("missing retailer product form fails closed", () => {
  const result = matchesProductTitle(
    "Delta Reign Booster Box",
    "Pokémon TCG Mega Evolution Delta Reign",
    "Booster Box"
  );
  assert.equal(result.matches, false);
  assert.equal(inferProductForm("Booster Box"), "booster-box");
});
