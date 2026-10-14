# Marketplace price tracking

## eBay Australia

The scheduled workflow `.github/workflows/marketplace-price-tracker.yml` uses eBay's official Browse API to find likely matching listings on the Australian marketplace. It stores up to five candidates per catalogue product in `marketplace-prices.json`, including item price, available shipping cost, estimated total, listing URL, seller and confidence score. It intentionally does not change the main product catalogue.

### Required repository secrets

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:

- `EBAY_CLIENT_ID`: eBay Developer Program application client ID (production).
- `EBAY_CLIENT_SECRET`: matching production client secret.
- `DISCORD_WEBHOOK_URL`: optional; reuses the existing Shaqs Poke Stock Discord webhook for price-drop alerts.

Do not place credentials in website JavaScript or commit them into the repository. eBay production API access is subject to eBay approval and rate limits. Until the two eBay secrets exist, the scheduled job safely skips without changing the existing snapshot.

The first successful run establishes a baseline. Later runs send a Discord alert when the same eBay item ID's estimated total falls by at least A$2 or 5%. A price is considered delivered total only when the API supplies a shipping cost; otherwise the UI identifies it as item price with shipping not confirmed.

Daily history is retained for up to 90 dates. The site also records a separate sealed-condition price series only for listings explicitly identified as sealed/new and where shipping-inclusive totals are available. After at least two successful daily snapshots, the UI can show a historical sealed-price movement signal when the recorded low moves by 5% or more. This is a marketplace reference, not proof of retailer stock or a guarantee that the current offer is still available. Older records without the sealed fields remain valid and are not backfilled or guessed.

## Amazon Australia

Amazon price data is not enabled yet. Its official Creators API requires a valid Amazon Australia Associates account and API credentials tied to that marketplace. Add that only after the account/API access is approved; don't scrape Amazon pages or put private keys in the browser. The front end is designed to keep marketplace offers separate from retailer catalogue data.
