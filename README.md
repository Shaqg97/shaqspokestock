# Shaqs Poke Stock

A mobile-first Pokémon TCG catalogue and deal-finding site for Australian collectors. The catalogue and watchlist remain local/static-first; marketplace and retailer availability are displayed with explicit freshness and verification limits.

## Project files

- `index.html` — clean landing page summary hub with dedicated navigation to the site's tools.
- `deals.html` — focused product catalogue, retailer offer comparison, search and sorting.
- `releases.html` — dedicated release/pre-order catalogue view.
- `alerts.html` — alert options and clear monitoring/configuration status.
- `stores.html` — retailer source coverage and freshness observations.
- `marketplace.html` — Australian eBay research links for catalogue products.
- `collection.html` — dedicated responsive collection dashboard for raw singles, graded slabs, sealed products, portfolio totals, filters, and CSV/JSON import/export. It supports local browser storage and optional Supabase cloud sync once configured.
- `account.html` — email sign-up, login, password reset and sign-out UI, backed by Supabase Auth when configured.
- `scan.html` — mobile camera/photo capture, optional browser OCR, TCGdex catalogue candidate matching, and add-to-collection workflow. Selected card artwork and catalogue IDs carry through into the collection. Matching is a candidate suggestion, not guaranteed identification or appraisal.
- `supabase-config.js` — public Supabase project URL/anon-key configuration template. Never put a service-role key in browser code.
- `supabase/collection_items.sql` — private per-user collection schema with row-level security and grading metadata.
- `products.json` — curated catalogue (45 products as of 14 October 2026; 44 have product images). Additions are reviewed, duplicate product names are blocked by validation, and existing entries should be preserved.
- `marketplace-prices.json` — eBay AU marketplace snapshot and daily history. Do not hand-edit prices or invent historical observations.
- `retailer-source-data.json` — latest direct-source retailer scan; blocked or skipped sources must remain unknown rather than being treated as sold out.
- `.github/scripts/` — scheduled data refresh, source monitoring, catalogue quality checks and Discord alert logic.
- `.github/workflows/validate-project.yml` — pull-request and main-branch validation.


## Site navigation and page separation

The landing page is intentionally a summary and navigation hub. Product browsing, releases, alert information, retailer source tracking and marketplace research live on separate pages to keep the homepage from becoming crowded. The personal collection and card scanner remain separate pages too.

## Account and cloud-sync setup

The public website is static GitHub Pages, so account authentication and private cloud storage need a Supabase project. The UI and client integration are prepared, but sign-in/cloud sync remain inactive until this one-time setup is completed.

1. Create a Supabase project on its free tier and enable Email authentication.
2. Open the Supabase SQL Editor and run the full contents of `supabase/collection_items.sql`.
3. In Supabase Auth URL configuration, add the deployed GitHub Pages site as the Site URL and add its `/account.html` and `/collection.html` URLs to allowed redirects as appropriate.
4. Edit `supabase-config.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with the project's URL and **public anon/publishable key**.
5. Commit the config. The public anon key is designed for browser use only when row-level security is enabled. **Never use the Supabase service_role/secret key in this repository.**
6. Test account creation, email confirmation, login, password reset, two-user isolation, and syncing from a second device before announcing cloud collections as production-ready.

The scanner uses camera permission in a secure context (HTTPS), browser OCR loaded on demand, and the public TCGdex API for candidate lookup. It does not upload the captured photo in this prototype. Catalogue results must be confirmed by the user. Live market valuation is not yet connected.

The Supabase free tier is intended to keep initial costs at $0, but usage limits and inactivity pausing may apply. Do not enable paid services without reviewing the cost first.

## Price and stock labels

- **Verified retailer price:** only a recent retailer observation that passes the site’s freshness and verification checks. It can still change before checkout.
- **Marketplace listing:** an eBay AU reference listing, not retailer stock verification. Check the item condition, seller, shipping and final checkout total.
- **Marketplace quality sort:** ranks recent eBay AU offers using condition, product-match confidence, known delivered totals and seller signals. A card can still show a verified retailer price if one is available.
- **Sealed eBay AU price target:** requires a recent marketplace snapshot (no older than 36 hours), explicit factory-sealed condition, at least 90% match confidence, a valid listing URL and a positive delivered total.
- **Unknown stock:** blocked or unavailable sources must not be displayed as sold out.

## Retailer link audit policy

A link checker reports whether an automated request succeeded; it does **not** prove that an offer is in stock, that the displayed price is current, or that checkout will work. Retailers and anti-bot/CDN services may reject `HEAD` requests, rate-limit automated traffic, or require browser sessions. Treat `403`, `429`, timeouts and a `HEAD`-only `404` as **inconclusive** until a cautious `GET` fallback (with a short timeout and limited response body) confirms the result. Do not repeatedly retry blocked endpoints, and do not mark a product sold out because a page could not be checked. A confirmed broken link should be separated from a blocked/unverifiable source in reports.

Before calling a price a current Australian deal, require a recent source observation and preserve the retailer URL, checked timestamp, currency, stock evidence and any caveats. Marketplace offers are separate from direct-retailer offers. If the source cannot be verified, show the last known observation with its age or label it unverified rather than implying a live deal.

## Mobile and accessibility QA

- Check the catalogue at narrow widths (320–390 px) as well as tablet and desktop widths.
- Ensure prices and metadata pills have strong contrast in both collapsed product rows and expanded details.
- Keep product links and buttons comfortably tappable, avoid horizontal overflow, and retain visible keyboard focus.
- Check missing-image fallbacks and empty/error states; do not let a failed image hide product identity or price context.
- Respect reduced-motion preferences and use descriptive labels for interactive controls.

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

For low-noise delivery, only send alerts when a qualifying observation changes meaningfully; deduplicate repeated observations, cap messages per run, and never ping a role when its configured ID is missing or malformed. A successful workflow means the job completed, not that every retailer was verifiable or that every Discord channel received a message. Review the run summary and alert counts before treating a run as healthy.

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

- [ ] Latest GitHub Actions validation is green for the latest commit.
- [ ] Site loads on desktop and mobile without horizontal overflow.
- [ ] Missing or broken product images show a compact package icon with an accessible “Image coming soon” hint.
- [ ] Best Deals sorts catalogue, fresh verified retailer prices and marketplace quality as labelled.
- [ ] Retailer target alerts and sealed eBay AU target alerts remain clearly distinct.
- [ ] Test alerts only with current, real prices; confirm marketplace totals include delivery.
- [ ] Confirm Discord secrets, channels and optional role IDs privately before enabling public alerts.
- [ ] Verify a real retailer or marketplace listing manually before purchasing; no listing is a stock guarantee.
