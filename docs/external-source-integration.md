# External stock-source integration plan

Last reviewed: 14 October 2026

## Current implementation

- The website has an **External stock & price sources** directory backed by `external-stock-sources.json`.
- The directory links users to useful Australian Pokémon TCG stock and price references.
- The directory labels each source's integration state so a third-party reference is not misrepresented as live, verified Shaqs Poke Stock data.
- This change does not alter the catalogue, retailer observations, eBay marketplace snapshot, price-target rules or Discord alert triggers.

## Provider findings and safeguards

### CardWatch AU
CardWatch's published terms of service (last updated 8 May 2026) explicitly prohibit scraping, mirroring, bulk re-extraction and redistribution of its catalogue, pricing and stock data. It is therefore included as a **manual cross-check link only**. Do not scrape its stock page or import its dataset.

Terms: https://www.cardwatch.com.au/terms

### CardTracker.au
Its API page advertises a market API, deals API and retailer-restock webhooks, and says cost depends on throughput and use case. This is the most promising automated integration candidate, but there is no API key, approved data licence or complete API schema configured in this repository.

API page: https://cardtracker.au/api

Before writing an active adapter, request:
1. API and webhook documentation, including authentication and example payloads.
2. Price, request-limit and retention/cache terms.
3. Permission to show the returned prices and stock on a public website and use signals in Discord alerts.
4. Product identifiers, timestamp semantics, retailer coverage and webhook retry/signature details.

### DexCompare, TCG Tracker AU and BuyWisely
These are external cross-checks for now. Do not scrape or bulk-copy their data unless an official API/feed and permitted-use terms are confirmed.

## Next implementation phase

Once CardTracker.au access is authorised, implement it as an optional server-side/GitHub Actions adapter that writes a separate provider snapshot. Keep it separate from `retailer-source-data.json` until matching and freshness tests pass.

Required safety checks:
- Match products using stable IDs where possible, otherwise strict name/set/language/type confidence.
- Record provider, product URL, observed time, price currency, availability and freshness.
- Unknown, stale, blocked or unmatched records must stay unknown; never convert missing data to sold out or zero.
- Do not let a provider overwrite a first-party retailer observation.
- Deduplicate Discord notifications across all providers by product, retailer, event type and time window.
- Respect API limits, cache requirements, licence restrictions and retailer terms.
- Validate a real retailer page before purchase; all stock data is subject to change.

## Current status

No external third-party stock data is being imported yet. CardWatch is deliberately not scraped because of its published terms. The website now provides a clear external-source directory, and CardTracker.au is documented as the next authorised API integration candidate.
