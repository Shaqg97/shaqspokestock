const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
if (!webhookUrl) throw new Error('DISCORD_WEBHOOK_URL is not configured.');
const parsed = new URL(webhookUrl);
if (parsed.protocol !== 'https:' || !['discord.com', 'discordapp.com'].includes(parsed.hostname) || !parsed.pathname.startsWith('/api/webhooks/')) {
  throw new Error('DISCORD_WEBHOOK_URL is not a valid Discord webhook URL.');
}
const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    username: 'Shaqs Poke Stock',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'Correction: Pocket Games Mega Brave booster box price',
      description: 'Please disregard the earlier $7.00 Pocket Games price alert for the Mega Brave M1L Booster Box. The retailer page exposes multiple variants, and that figure was not a verified booster-box price. The catalogue has been restored to its previous $155.00 reference price and the offer is marked unverified until the correct box variant is confirmed.',
      color: 0xe67e22,
    }],
  }),
});
if (!response.ok) throw new Error(`Discord rejected the correction (HTTP ${response.status}).`);
console.log('Sent correction for the unverified Pocket Games variant price.');
