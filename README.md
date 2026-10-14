# Shaqs Poke Stock

A mobile-first Pokémon TCG catalogue and deal-finding site for Australian collectors. The catalogue and watchlist remain local/static-first; marketplace and retailer availability are displayed with explicit freshness and verification limits.

## Project files

- `index.html` — site UI, product cards, Best Deals sorting, price history, local watchlist and price targets.
- `products.json` — curated catalogue (currently intentionally validated as 31 products). Keep existing entries unless a catalogue change is deliberately reviewed.
- `marketplace-prices.json` — eBay AU marketplace snapshot and daily history. Do not hand-edit prices or invent historical observations.
- `retailer-source-data.json` — latest direct-source retailer scan; blocked or skipped sources must remain unknown rather than being treated as sold out.
- `.github/scripts/` — scheduled data refresh, source monitoring, catalogue quality checks and Discord alert logic.
- `.github/workflows/validate-project.yml` — pull-request and main-branch validation.

## Price and stock labels

- **Verified retailer price:** only a recent retailer observation that passes the site’s freshness and verification checks. It can still change before checkout.
- **Marketplace listing:** an eBay AU reference listing, not retailer stock verification. Check the item condition, seller, shipping and final checkout total.
- **Marketplace quality sort:** ranks recent eBay AU offers using condition, product-match confidence, known delivered totals and seller signals. A card can still show a verified retailer price if one is available.
- **Sealed eBay AU price target:** requires a recent marketplace snapshot (no older than 36 hours), explicit factory-sealed condition, at least 90% match confidence, a valid listing URL and a positive delivered total.
- **Unknown stock:** blocked or unavailable sources must not be displayed as sold out.

## Local watchlist and price targets

The browser stores watchlist and price-target data in local storage on that device/browser. It does not sync between devices or browsers.

Price targets can use either:
1. **Verified retailer** — fresh, verified retailer prices only.
2. **Sealed eBay AU total** — a recent factory-sealed listing with a known delivered total; this is a marketplace reference, not a guarantee the listing remains active.

Targets are checked when the page loads or refreshes. This static site does not run background checks while closed. Browser notifications require permission and depend on the page being open when a target is detected. Existing price targets without a source continue to be treated as verified-retailer targets.

## Marketplace data refresh

The marketplace refresh script requires these GitHub Actions repository secrets:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`

Without them, the refresh deliberately fails rather than reporting a false success. Never put credentials in `index.html`, JSON files, commits or issues.

## Discord alerts

Discord delivery is managed separately from local browser targets. The alert workflow requires `DISCORD_WEBHOOK_URL`; optional channel-specific webhook secrets and role IDs are supported by `.github/scripts/send-discord-alerts.mjs`. Add secrets only through GitHub repository Actions settings. Never commit webhook URLs or tokens. Test role IDs and each alert category before announcing a public launch.

## Validation

The repository uses Node.js 24 in GitHub Actions. Run these checks from the repository root:

```sh
node --test .github/scripts/test-marketplace-quality-rules.mjs
node --test .github/scripts/test-marketplace-snapshot-quality.mjs
node --test .github/scripts/test-discord-alert-rules.mjs
node .github/scripts/validate-catalogue-quality.mjs
```

The CI workflow also validates catalogue and marketplace JSON, retailer-source observations, inline page JavaScript syntax, supporting script syntax and required page features.

## Launch QA checklist

- [ ] Latest GitHub Actions validation is green.
- [ ] Site loads on desktop and mobile.
- [ ] Missing or broken product images show the branded “Image coming soon” fallback.
- [ ] Best Deals sorts catalogue, fresh verified retailer prices and marketplace quality as labelled.
- [ ] Retailer target alerts and sealed eBay AU target alerts remain clearly distinct.
- [ ] Test alerts only with current, real prices; confirm marketplace totals include delivery.
- [ ] Confirm Discord secrets, channels and optional role IDs privately before enabling public alerts.
- [ ] Verify a real retailer or marketplace listing manually before purchasing; no listing is a stock guarantee.
