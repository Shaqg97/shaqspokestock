// Conservative product matching for retailer monitoring.
// Product form is part of identity: a booster pack must never verify a booster box.
const FORMS = [
  ["booster-box", /\b(?:booster box|booster display|display box)\b/i],
  ["booster-pack", /\b(?:booster pack|single booster|sleeved booster|booster single)\b/i],
  ["booster-bundle", /\bbooster bundle\b/i],
  ["elite-trainer-box", /\b(?:elite trainer box|etb)\b/i],
  ["league-battle-deck", /\bleague battle deck\b/i],
  ["battle-deck", /\bbattle deck\b/i],
  ["premium-collection", /\bpremium collection\b/i],
  ["collection-box", /\bcollection box\b/i],
  ["mini-tin", /\bmini tin\b/i],
  ["tin", /\btin\b/i],
  ["blister", /\bblister\b/i],
  ["booster-bundle", /\bbooster bundle\b/i],
  ["bundle", /\bbundle\b/i],
  ["deck", /\bdeck\b/i],
  ["pack", /\bpack\b/i],
  ["box", /\bbox\b/i],
];

const GENERIC = new Set([
  "pokemon", "pokémon", "tcg", "trading", "card", "cards", "booster", "box",
  "pack", "packs", "japanese", "english", "sealed", "the", "and", "for",
  "with", "mega", "evolution", "single", "display", "sleeved", "collection",
  "premium", "elite", "trainer", "league", "battle", "deck", "mini", "tin",
  "blister", "bundle", "assorted", "36", "30",
]);

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function inferProductForm(...values) {
  const text = values.filter(Boolean).join(" ");
  for (const [form, pattern] of FORMS) {
    if (pattern.test(text)) return form;
  }
  return null;
}

export function matchesProductTitle(expectedName, actualTitle, expectedType = "") {
  const expectedForm = inferProductForm(expectedType, expectedName);
  const actualForm = inferProductForm(actualTitle);
  if (expectedForm && actualForm && expectedForm !== actualForm) {
    return { matches: false, reason: `product type mismatch (${expectedForm} vs ${actualForm})` };
  }
  // If the catalogue specifies a physical format but the retailer title does not,
  // fail closed: insufficient title evidence must not verify a price or stock state.
  if (expectedForm && !actualForm) {
    return { matches: false, reason: `retailer title does not confirm product type (${expectedForm})` };
  }

  const expected = normalize(expectedName).filter(word => word.length > 2 && !GENERIC.has(word));
  const actual = new Set(normalize(actualTitle).filter(word => word.length > 2 && !GENERIC.has(word)));
  const overlap = expected.filter(word => actual.has(word));
  if (expected.length < 2 || overlap.length < 2 || overlap.length / expected.length < 0.5) {
    return { matches: false, reason: "title mismatch" };
  }
  return { matches: true, reason: "title and product form matched" };
}
