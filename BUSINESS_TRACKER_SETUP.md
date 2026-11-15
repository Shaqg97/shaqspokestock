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

The Edge Function validates the signed-in Supabase user and uses the service role only inside the server function. Never expose these secrets in GitHub, HTML, browser config or chat.

## 4. Whatnot
Create a personal access token in the Whatnot developer dashboard with at least `read:orders`, `read:reports` and `read:shows` as required. Whatnot Seller API base URL: `https://api.whatnot.com/seller-api/rest/v2`. The API supports orders, shows and show analytics. Add a webhook subscription for `orders.created` if your developer app supports it; the scheduled sync remains a backstop.

## 5. eBay
Use your eBay developer app's production keys and complete the OAuth authorisation-code flow for the seller account. The existing client ID/secret alone are not enough to read private seller orders: a seller-authorised refresh token with `sell.fulfillment.readonly` and `sell.finances` scopes is required. Add the refresh token as a Supabase secret, not a repository secret. eBay order imports use the Fulfillment API; fee/payout reconciliation can be expanded using the Finances API once the required scopes and transaction data are available.

## 6. Automatic sync
For initial rollout, invoke the sync function from the dashboard and schedule it (e.g. every 15 minutes) with Supabase Cron/pg_cron or an external scheduler. Add Whatnot webhooks after registering the HTTPS webhook URL in Whatnot's developer dashboard. The database unique key on platform + order ID + line ID prevents duplicate order imports.

## Accounting notes
- Gross sales = item amount + buyer-paid shipping.
- Net sale profit = gross + shipping - platform fees - postage - other fees - cost of goods sold - refunds.
- Stock cost is stored as total purchase cost / quantity. For multi-unit stock, match sold lines to a SKU so COGS can be allocated correctly.
- Do not subtract a payout again as an expense: payouts are cash movements, not additional selling fees.
- The first version imports sales and records stock costs. Exact line-item fee allocation and automated stock matching may require SKU mapping or manual matching for products sold as break lots.
