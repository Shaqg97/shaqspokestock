# Shaq's Poke Stock — Business Tracker setup

This feature adds a private business ledger and a mobile-first dashboard to the static GitHub Pages site. It uses Supabase Auth + Postgres + Edge Functions; marketplace credentials are server-side only.

## 1. Supabase database
1. Open your Supabase project SQL Editor.
2. Run the complete file `supabase/business_tracker.sql`.
3. Confirm RLS is enabled on `business_stock`, `business_sales` and `business_sync_runs`.

## 2. Site configuration
The existing `supabase-config.js` still needs the project URL and public anon/publishable key. Never add a service-role key to browser JavaScript.

## 3. Edge Function
Deploy `supabase/functions/sync-marketplace/index.ts` as the Supabase Edge Function named `sync-marketplace`. Set Edge Function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `WHATNOT_API_TOKEN` (Whatnot Seller API personal access token)
- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_REFRESH_TOKEN` (seller-authorised OAuth refresh token)
- `EBAY_MARKETPLACE_ID` = `EBAY_AU`
- `TRACKER_CRON_SECRET` (long random value used only by the scheduled GitHub Action)
- `TRACKER_USER_ID` (your Supabase Auth user UUID; scheduled sync writes to this account)

The Edge Function validates the signed-in Supabase user and uses the service role only inside the server function. Never expose these secrets in GitHub, HTML, browser config or chat.

## 4. Whatnot
Create a personal access token in the Whatnot developer dashboard with at least `read:orders`, `read:reports` and `read:shows` as required. Whatnot Seller API base URL: `https://api.whatnot.com/seller-api/rest/v2`. The API supports orders, shows and show analytics. Add a webhook subscription for `orders.created` if your developer app supports it; the scheduled sync remains a backstop.

## 5. eBay
Use your eBay developer app's production keys and complete the OAuth authorisation-code flow for the seller account. The existing client ID/secret alone are not enough to read private seller orders: a seller-authorised refresh token with `sell.fulfillment.readonly` and `sell.finances` scopes is required. Add the refresh token as a Supabase secret, not a repository secret. eBay order imports use the Fulfillment API; fee/payout reconciliation can be expanded using the Finances API once the required scopes and transaction data are available.

## 6. Automatic sync
The repository includes `.github/workflows/marketplace-sales-sync.yml`, scheduled every 15 minutes and manually runnable from GitHub Actions. Add these GitHub Actions repository secrets:
- `TRACKER_FUNCTION_URL` = your deployed Supabase function URL, e.g. `https://PROJECT_REF.supabase.co/functions/v1/sync-marketplace`
- `TRACKER_CRON_SECRET` = the exact same random secret configured in Supabase Edge Function secrets.

Set `TRACKER_USER_ID` in Supabase Edge Function secrets to your Supabase Auth user UUID. The scheduled workflow invokes both platforms using a dedicated secret header; the dashboard's manual sync uses the signed-in user's session. Add a Whatnot webhook subscription for `orders.created` after registering a separate HTTPS webhook endpoint in Whatnot's developer dashboard; the 15-minute polling job is the current backstop. The database unique key on platform + order ID + line ID prevents duplicate order imports.

## Accounting notes
- Gross sales = item amount + buyer-paid shipping.
- Net sale profit = gross + shipping - platform fees - postage - other fees - cost of goods sold - refunds.
- Stock cost is stored as total purchase cost / quantity. For multi-unit stock, match sold lines to a SKU so COGS can be allocated correctly.
- Do not subtract a payout again as an expense: payouts are cash movements, not additional selling fees.
- The first sync implementation imports order lines and records stock costs. It does not yet import eBay Finances API fee/payout transactions or automatically infer COGS when a marketplace listing cannot be matched to a stock SKU. Those are the next integration steps; until then, net-profit figures are provisional and should not be treated as tax-ready accounts.
