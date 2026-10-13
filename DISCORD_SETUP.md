# Shaqs Poke Stock Discord Setup

This guide describes the recommended Discord server layout and the one-time configuration needed for opt-in member stock alerts.

## 1. Create these categories and channels

### START HERE
- `👋・welcome` — read-only welcome, rules, and server purpose.
- `📢・announcements` — staff-only posting for important updates.
- `🔔・choose-alerts` — explain notification roles and how to opt in.
- `📌・how-to-use` — website link, add-to-home-screen guide, and alert FAQ.

### STOCK & RELEASE ALERTS
- `🚨・restock-alerts` — verified restock and new in-stock alerts.
- `🛒・preorder-alerts` — verified pre-order changes.
- `💸・price-drops` — verified price reductions.
- `📅・release-calendar` — release dates and launch reminders.
- `🏬・retailer-updates` — which stores are monitored and known coverage limitations.

### STORE & COMMUNITY
- `🟣・big-w`
- `🟢・kmart`
- `🔴・target`
- `🔵・jb-hi-fi`
- `🎴・pokemon-chat`
- `💎・deals-and-finds`

### HELP & STAFF
- `❓・support` — member questions and bug reports.
- `📝・product-requests` — request products/retailers to track.
- `🛡️・staff-chat` — private to Admin and Moderator.
- `🧪・alert-testing` — private test channel for staff.

Start with welcome, announcements, choose-alerts, restock-alerts, preorder-alerts, price-drops, retailer-updates, support, staff-chat, and alert-testing. Add the community/store channels when useful.

## 2. Create roles

Create these in Server Settings → Roles:
- `Admin` — server owner only.
- `Moderator` — trusted staff.
- `🔔 Stock Alerts` — restock, new in-stock, and pre-order notifications.
- `💸 Price Drops` — optional price-drop interest role.
- Optional interest roles: `🇦🇺 BIG W`, `🛒 Kmart`, `🎯 Target`, `🔵 JB Hi-Fi`.

Do not give notification roles administrative permissions. Move the bot/webhook-managed roles below your staff roles. A webhook itself does not need a Discord bot role.

## 3. Configure the stock-alert ping

The website alert workflow supports an optional role mention for stock/pre-order alerts. It does not ping anyone until the role ID secret is configured.

1. In Discord, enable Developer Mode: User Settings → Advanced → Developer Mode.
2. Right-click the `🔔 Stock Alerts` role in Server Settings → Roles and choose Copy Role ID.
3. In GitHub, open the repository `Shaqg97/shaqspokestock` → Settings → Secrets and variables → Actions → New repository secret.
4. Add secret name `DISCORD_STOCK_ALERT_ROLE_ID` and paste the copied numeric role ID as its value.
5. Keep the existing `DISCORD_WEBHOOK_URL` secret configured for the alerts channel. Never paste webhook URLs or credentials into public chat or source files.
6. Run the `Test Discord webhook` workflow in Actions to confirm the webhook can post to the selected channel. The test confirms delivery, not role pings.
7. Test role pings only after the role ID secret is set and a verified stock/pre-order change occurs. Do not manually expose the webhook URL.

Only the configured Stock Alerts role is allowed to be mentioned by the workflow. Price-drop and general information messages do not ping this role. If the secret is absent, alerts still post without member pings.

## 4. Let members opt in

Preferred: enable Community features and configure Server Settings → Onboarding so members can choose the notification roles they want when joining. If Onboarding role assignment is not available in your server setup, use a reputable role-selection bot with a role menu in `🔔・choose-alerts`, or assign roles manually while the community is small.

Suggested text for `🔔・choose-alerts`:

> **Choose your Shaqs Poke Stock alerts**
>
> - Choose **Stock Alerts** for restocks, new in-stock listings, and pre-order changes.
> - Choose **Price Drops** if you want price-reduction updates.
> - Store-interest roles are optional and can be used to tailor store-specific discussion and future alerts.
> - You can remove a role at any time to stop receiving its role mentions.
>
> Stock and price information can change quickly. Always open the retailer listing to confirm availability, delivery costs, and checkout details.

## 5. Channel permissions

- In announcement and automated alert channels, deny `@everyone` the `Send Messages` permission; allow staff to post.
- In `staff-chat` and `alert-testing`, make the channels private and grant access only to Admin/Moderator.
- In community channels, allow members to send messages but enable sensible anti-spam settings.
- Keep role pings opt-in. Do not use `@everyone` for routine stock alerts.

## 6. Current automation limitations

- Product and price alerts only qualify when the monitoring workflow has a fresh explicit verification marker.
- Kmart and BIG W monitoring may be limited when their storefronts block automated requests. Do not treat blocked or unknown pages as confirmed out of stock.
- The optional role mention currently targets the single `DISCORD_STOCK_ALERT_ROLE_ID` role. Price-drop role pings are not wired up yet.
