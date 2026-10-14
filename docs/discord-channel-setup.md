# Discord channel routing for Shaqs Poke Stock

The alert workflow supports a separate Discord webhook per channel. The existing `DISCORD_WEBHOOK_URL` remains the fallback, so existing setup continues to work.

## Recommended channels

- `#stock-alerts`: verified restocks, new in-stock listings and pre-orders
- `#price-drops`: verified price reductions
- `#new-releases`: newly tracked Pokémon releases
- `#general` or `#bot-updates`: new products and informational updates (existing webhook)

## GitHub Actions repository secrets

Create a webhook inside each target Discord channel (Server Settings → Integrations → Webhooks), then add its URL under GitHub → repository Settings → Secrets and variables → Actions:

- Required existing fallback: `DISCORD_WEBHOOK_URL`
- Optional stock channel: `DISCORD_STOCK_WEBHOOK_URL`
- Optional price channel: `DISCORD_PRICE_DROP_WEBHOOK_URL`
- Optional release channel: `DISCORD_RELEASE_WEBHOOK_URL`

If an optional channel webhook is absent, that category falls back to `DISCORD_WEBHOOK_URL`. This keeps alerts working while the channels are being configured.

## Optional role pings

Create roles in Discord (Server Settings → Roles), enable Developer Mode, then right-click each role and choose Copy Role ID. Add only the IDs you want:

- `DISCORD_STOCK_ALERT_ROLE_ID`
- `DISCORD_PRICE_DROP_ROLE_ID`
- `DISCORD_RELEASE_ALERT_ROLE_ID`

The role must be mentionable by the webhook/bot or the server's permissions must permit it. The workflow restricts allowed mentions to the selected role ID, never @everyone or arbitrary users. Role IDs are optional; without them the alert posts without a ping.

## Test each route

Run [Test Discord webhook](https://github.com/Shaqg97/shaqspokestock/actions/workflows/test-discord-webhook.yml) and select `default`, `stock`, `price`, or `release`. Each run posts a clearly labelled test message. If the channel-specific webhook is not set, it uses the default webhook; add the relevant secret first if you want to verify delivery to a distinct channel.

Webhook URLs are credentials: store them only as GitHub Actions secrets and never commit or paste them into public issues.
