# Shaq's Poke Stock — Physical Inventory & SKU Workflow

**Configured for:** mixed storage and an opening inventory of approximately 2,000 Pokémon TCG cards.  
**Principle:** a SKU is a permanent physical address. Card identity and market data live in the digital inventory; the SKU tells you exactly where to pick the card.

## 1. Storage zones

Use three physically distinct zones with large, visible labels:

| Zone | Purpose | Storage | SKU prefix |
|---|---|---|---|
| H — Hits | Higher-value singles, special illustrations, vintage, grading candidates | Binder with side-loading pockets or a protected premium-card box | H |
| S — Singles | Regular individually listed cards | Long cardboard trading-card boxes with dividers | S |
| L — Lots | Ready-made bundles, playsets, themed lots and bulk lots | Separate labelled boxes; bag each lot | L |

Keep sealed product separate from singles inventory. Keep sold/awaiting-dispatch orders in a small outbound tray, not mixed back into saleable stock.

### Sensible starting capacity for 2,000 cards

This is a planning allowance, not a claim about the actual value distribution of the collection:

- **S zone:** plan for roughly 1,200–1,500 cards, split across three numbered long boxes (S01–S03). Keep a fourth box or spare capacity available.
- **H zone:** reserve approximately 100–200 premium-card pockets in binder H01. Only move a card here after triage; do not fill it with ordinary low-value bulk.
- **L zone:** reserve two labelled lot boxes (L01–L02) for prepared bundles and bulk lots. Each bag/lot gets its own L SKU.
- Leave space for growth. Start a new numbered box or binder when the current one is full; do not renumber existing stock.

If the actual hit count or bulk count differs, change the number of cards in each zone—not the SKU structure.

## 2. SKU format

### H — Binder location

Format: `H{binder}-P{page}-{pocket}`

Example: `H01-P02-04` = binder 01, page 02, pocket 04.

- Number pages consistently from the front.
- Number pockets left-to-right, top-to-bottom.
- Put one card per pocket unless the binder is explicitly being used for a matched set/lot.
- If using a premium storage box instead of a binder, document a consistent H-box position format and do not mix formats.

### S — Standard singles box

Format: `S{box}-{position}`

Example: `S01-0042` = singles box 01, divider/position 0042.

- Add cards to the next empty numbered position in intake order.
- Use numbered dividers or small position ranges (for example, 0001–0050, 0051–0100).
- Do not alphabetise or reorder the physical cards every time new stock arrives. Search the digital inventory instead.
- A card's SKU remains unchanged while it is listed, sold, picked or returned to the same slot.

### L — Bundle or bulk lot

Format: `L{box}-{lot}`

Example: `L01-0012` = lot box 01, lot 0012.

- Put each complete bundle in its own bag or team bag.
- Label the bag with its SKU, card count, language and a short theme.
- Do not combine two lots under one SKU unless the listing is deliberately one combined lot.
- Keep bulk lots physically separate from individual singles.

### Permanent SKU rules

1. Assign a SKU before publishing a listing.
2. Never reuse a SKU after a sale, even if the slot becomes empty.
3. If a card moves, update its location in the inventory record immediately; keep a movement note.
4. If a bundle is broken apart, close/archive its L SKU and assign new H/S SKUs to the component cards.
5. Store the SKU in the listing custom label/SKU field where supported, and include it in your own inventory record.
6. Do not encode price, card name, set, condition or date in the SKU. Those attributes change or are searchable fields.

## 3. Triage rules

Process every incoming batch in this order:

1. **Separate obvious hits:** valuable singles, special illustrations, vintage, promos, playable cards with demand, and grading candidates. Check condition carefully. Route to H only when justified.
2. **Identify standard singles:** cards with enough individual demand/value to justify their own listing. Route to S.
3. **Build curated bundles:** group low-priced cards by a coherent buyer reason—same Pokémon/evolution line, set, type, playable theme, language, or character. Route the finished bag to L.
4. **Bulk remainder:** count accurately and make clear bulk lots. Do not describe a mixed lot as a complete set unless verified.
5. Confirm language, set, collector number, finish/variant and condition before listing. Front/back photos and manual verification are required; image recognition or catalogue matches are candidates, not proof.

Suggested initial listing decision guide (use sold comps and demand, not price alone):
- Around A$20+ often merits an individual listing.
- A$5–A$19.99: individual if demand/search interest supports it; otherwise bundle.
- Under A$5: usually bundle unless the card has clear demand or a strong search term.
- Bulk commons/uncommons: counted lots, not hundreds of low-value individual listings.

These are triage defaults, not guaranteed market values or fixed thresholds.

## 4. Digital inventory fields

Every physical item or lot should have:

- SKU / physical location (**mandatory before listing**)
- Card name, set name, collector number
- Language, rarity, finish/variant
- Condition and quantity
- Acquisition source, date and cost per card/lot
- Listing type (individual / bundle / bulk)
- Listing status: To identify → To price → Ready to list → Listed → Sold → Packed → Shipped; also Returned / Archived
- eBay listing ID or URL, asking price and listing date
- Sold-comparable price, number of comps, source and checked date
- Buyer-paid shipping, actual postage, packaging and fee assumptions
- Sale proceeds, actual fees and realised net profit
- Photo filenames or image references

Do not confuse asking prices with completed sale prices. Record realised proceeds and costs separately.

## 5. Intake and listing workflow

1. Count the incoming cards and record the total acquisition cost.
2. Scan or photograph fronts and backs in manageable batches.
3. Create one inventory row per distinct card/lot; pair front/back images by filename and verify manually.
4. Confirm exact print: language, set, collector number, holo/reverse holo or other finish, promo stamp and condition.
5. Research recent Australian eBay sold/completed listings for the exact variant. Record source/date and avoid relying on active asking prices alone.
6. Decide H, S or L and assign the physical SKU.
7. Add the SKU to the listing and inventory row before publishing.
8. Store the card immediately in its assigned location.
9. On sale, pick by SKU—not by card name or memory. Scan/confirm the card against the order before packing.
10. Record actual postage, packaging, platform fees and sale proceeds to calculate realised net profit.

## 6. Pick, pack and dispatch

- Keep sleeves, toploaders/card savers, team bags, cardboard protection and mailers together at a packing station.
- Pick from the SKU, then verify card name, set, number, language and variant.
- Photograph or otherwise verify higher-value orders before sealing.
- Offer tracked/untracked choices only where the selected Australia Post service and packaging qualify. Check current size, thickness, weight and tracking requirements; a rigid toploader may affect letter eligibility.
- Put sold orders into an outbound tray with order ID and SKU. Never put packed orders back into active stock.
- Mark the item Packed/Shipped and record the tracking number when applicable.

## 7. Weekly stock control

Once a week:
- Reconcile sold listings against physical stock.
- Check that every active listing has a valid SKU and the card is still in its assigned location.
- Investigate missing, duplicate or returned items.
- Review views/watchers and reprice stale listings based on fresh sold comps.
- Combine slow-moving low-value cards into useful lots where appropriate.
- Review net profit after card cost, packaging, postage and actual selling fees.

## 8. Physical labels to print

Use large labels on the front and top of every container:

- `H01 — HITS / PREMIUM BINDER`
- `S01 — STANDARD SINGLES / POSITIONS 0001–0500`
- `S02 — STANDARD SINGLES / POSITIONS 0001–0500`
- `S03 — STANDARD SINGLES / POSITIONS 0001–0500`
- `L01 — READY-TO-SELL LOTS`
- `L02 — BULK LOTS / UNLISTED`
- `OUTBOUND — SOLD / AWAITING DISPATCH`

Only use the position ranges you actually label and maintain. The numbering is a location system, not an estimate of how many cards fit in a box.

---

**Operational rule:** no listing goes live without a SKU; no order is picked without checking the SKU; no SKU is reused.
