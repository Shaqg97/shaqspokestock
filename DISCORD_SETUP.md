# Shaqs Poke Stock Discord Setup

All automated Shaqs Poke Stock notifications go to **one Discord channel**. The message prefix identifies the alert type:

- 📦 **STOCK / RESTOCK** — verified stock, restocks and pre-orders
- 💸 **PRICE DROP** — meaningful verified price reductions
- 🗓️ **NEW RELEASE** — newly tracked releases
- ℹ️ **CATALOGUE UPDATE** — other catalogue changes

## 1. Choose the alert channel

Create or choose one channel, for example `#poke-stock-alerts`. The channel name is yours to change later; the webhook remains attached to the channel if you rename it.

## 2. Configure the one webhook

1. Open the chosen channel in Discord.
2. Open **Edit Channel → Integrations → Webhooks** and create a webhook for that channel.
3. Copy the webhook URL.
4. In GitHub, open `Shaqg97/shaqspokestock` → **Settings → Secrets and variables → Actions**.
5. Create or update the repository secret named `DISCORD_WEBHOOK_URL` with that URL.

Keep the webhook URL private. Never paste it into chat, issues, source files or screenshots.

Only `DISCORD_WEBHOOK_URL` is required by the current alert sender. Older separate webhook and role-ID secrets may remain in GitHub, but the current sender does not use them. The sender deliberately disables role and user mentions; each alert is labelled in the message instead.

## 3. Receive the notifications

In Discord, set the notification override for `#poke-stock-alerts` to **All Messages** if you want push notifications for webhook posts. Set other channels to **Nothing** or mute them if you only want Shaqs Poke Stock alerts.

No role mention is sent, so an “Only @mentions” setting on the alert channel may suppress notifications for these messages.

## 4. Test delivery

1. Open the repository's **Actions** tab.
2. Select **Test Discord webhook**.
3. Choose `default` for a general test, or `stock`, `price` or `release` to test the corresponding label.
4. Run the workflow and confirm that one message appears in the chosen channel.

A successful workflow run confirms Discord accepted the webhook request. It does not prove retailer monitoring has found stock.

## 5. Monitoring limits

- Alerts are sent only when the monitoring logic detects qualifying changes from fresh, explicit evidence.
- A successful monitoring run does not mean every retailer was accessible or every product was verified.
- Kmart, BIG W, EB Games and other sites may block, rate-limit or restrict automated page checks. Blocked or unknown results are not treated as sold out.
- Always open the retailer's own listing and confirm availability, delivery costs, limits and the final checkout total before purchasing.
