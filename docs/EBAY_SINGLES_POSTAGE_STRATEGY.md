# Shaq's Poke Stock — eBay Singles & Postage Strategy

## Confirmed seller preferences
- Listing mix: individual singles plus curated bundles.
- Postage payment: buyer pays.
- Shipping choices: offer an untracked letter option only when the card/package is eligible under Australia Post rules, and offer a tracked service for buyers who want tracking or for higher-value orders.
- Initial scan batch: six cards; scale after the workflow is tested.
- Currency: AUD.

## Listing decision guide
- Use individual listings for cards with meaningful standalone demand/value.
- Consider bundles for low-value cards, playsets, evolution lines, character collections, and cards where separate listings would not justify handling time.
- The under-A$3 threshold is a review prompt, not an automatic rule. Check sold demand, rarity, and buyer search behaviour before bundling.
- Keep exact card identity, set, collector number, language, finish/variant, and condition verified before export.

## Profit calculation
For each shipping choice, calculate:
- Item revenue = asking price × quantity.
- Buyer-paid postage = the configured shipping charge for that service.
- Percentage selling fee estimate = (item revenue + buyer-paid postage) × configured fee rate.
- Estimated net = item revenue + buyer-paid postage − card acquisition cost − packaging cost − actual postage cost − percentage fee estimate − fixed fee estimate.

The bulk workspace stores fee rate and fixed fee estimates in this browser. They default to zero and must be set to the seller's actual applicable fees before relying on net-profit estimates. The estimate excludes tax, refunds, chargebacks, labour, storage, and other overheads. For orders with multiple listings, fixed fees and postage should be reconciled to the actual order rather than assumed per card.

## Postage and packaging safeguards
- Never offer untracked letter postage unless the final packed item meets the current Australia Post service requirements for size, thickness, flexibility, contents, and address presentation.
- Rigid toploaders or other inflexible packaging may make an item ineligible for ordinary letter rates. Use a suitable tracked parcel service when required.
- Buyer-facing postage prices and actual postage costs are separate inputs; record both so postage is not mistaken for item margin.
- The buyer selects and pays for the postage service shown in the listing. Dispatch using the service purchased and retain proof of lodgement.
- Recheck current Australia Post and eBay requirements/prices before publishing shipping policies.

## Export
The current workspace export is a listing-preparation CSV. It is not represented as a certified direct eBay Seller Hub upload template. Map the prepared records to the current eBay AU bulk listing template before upload.
