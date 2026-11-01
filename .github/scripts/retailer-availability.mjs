export function hasNotifyOnlyMessage(pageHtml) {
  const visibleSource = String(pageHtml ?? '')
    .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, ' ');
  return /get notified when it['’]s back|notify me when (?:this|the|it) (?:is )?back in stock|email me when (?:this|the|it) (?:is )?back in stock/i.test(visibleSource);
}

export function classifyAvailability(rawAvailability, pageHtml = '') {
  // A product page that explicitly offers notification-only access is not
  // checkout-available, even if stale JSON-LD says InStock or PreOrder.
  if (hasNotifyOnlyMessage(pageHtml)) return 'out of stock';
  const value = String(rawAvailability ?? '').toLowerCase().replace(/[\\s_-]+/g, '');
  if (/preorder|presale/.test(value)) return 'pre-order';
  if (/outofstock|soldout|discontinued|backorder/.test(value)) return 'out of stock';
  // OnlineOnly describes a sales channel, not proof of available inventory.
  if (/instock|limitedavailability|lowstock/.test(value)) return 'in stock';
  return 'unknown';
}

export function toRetailerStock(rawAvailability, pageHtml = '') {
  const value = classifyAvailability(rawAvailability, pageHtml);
  return ({
    'in stock': 'In Stock',
    'pre-order': 'Pre-Order',
    'out of stock': 'Sold Out',
  })[value] ?? null;
}
