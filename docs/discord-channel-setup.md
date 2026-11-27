# Discord alert channel setup

Shaqs Poke Stock sends every automated notification to one Discord channel through the repository secret `DISCORD_WEBHOOK_URL`. Category labels distinguish the messages:

- 📦 STOCK / RESTOCK
- 💸 PRICE DROP
- 🗓️ NEW RELEASE
- ℹ️ CATALOGUE UPDATE

## Configure the channel

1. Choose or create one channel, such as `#poke-stock-alerts`.
2. In that channel, open **Edit Channel → Integrations → Webhooks** and create a webhook.
3. Copy its URL and store it in GitHub repository **Settings → Secrets and variables → Actions** as `DISCORD_WEBHOOK_URL`.
4. Keep the URL private. Do not commit it or paste it into issues or chat.

The channel may be renamed in Discord later; the webhook remains connected to that channel. No separate stock, price or release webhooks are needed. Older dedicated webhook and role-ID secrets can be left in GitHub, but the current alert sender ignores them. Role and user mentions are disabled.

## Notifications

Set the chosen alert channel's notification override to **All Messages** if you want push notifications for webhook posts. Other channels can be muted or set to **Nothing**. Because the webhook does not mention a role or user, **Only @mentions** may suppress its notifications.

## Test

Run [Test Discord webhook](https://github.com/Shaqg97/shaqspokestock/actions/workflows/test-discord-webhook.yml). Select `default`, `stock`, `price` or `release`; every option posts one labelled test message to the same `DISCORD_WEBHOOK_URL` destination.

Webhook URLs are credentials. Store them only as GitHub Actions secrets.
