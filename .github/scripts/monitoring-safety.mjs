export function isMeaningfulPriceDrop(oldPrice, newPrice) {
  const previous = Number(oldPrice);
  const next = Number(newPrice);
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= 0 || next <= 0 || next >= previous) return false;
  return previous - next >= Math.max(2, previous * 0.05);
}

export function retailerPriceSourcesAgree(apiOffer, pageOffer) {
  if (!apiOffer || !pageOffer) return false;
  const apiPrice = Number(apiOffer.price);
  const pagePrice = Number(pageOffer.price);
  if (!Number.isFinite(apiPrice) || !Number.isFinite(pagePrice) || apiPrice <= 0 || pagePrice <= 0) return false;
  return Math.abs(apiPrice - pagePrice) < 0.01 && apiOffer.stock === pageOffer.stock;
}
