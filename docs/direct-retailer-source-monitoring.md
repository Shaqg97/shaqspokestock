# Direct retailer source monitoring

The scheduled pipeline discovers retailer hosts from the curated offers in \`products.json\` and checks those product URLs where public access is permitted. This covers BIG W, Kmart, Target, JB Hi-Fi, EB Games and the other specialist Australian retailers already listed in the catalogue. It writes \`retailer-source-data.json\` for the site's release/store tracker. New catalogue retailer hosts are included automatically.

## Data handling
- Public first-party product pages only; checks \`robots.txt\` before fetching product pages.
- One product request at a time with 1.8 seconds between requests.
- Does not bypass CAPTCHA, login walls, bot protection, HTTP 403 or HTTP 429.
- Fetch status is separate from availability. A blocked, skipped, failed or unparseable page is unknown, not sold out.
- Records inventory/allocation quantities only when an explicit field appears in the retailer's structured page data. Never infers quantities from pack counts or purchase limits.
- Does not overwrite main catalogue prices or stock states; this pipeline is observational and independent.
- Missing quantities are not zero. Exact store allocations only appear if exposed in accessible first-party page data.

## Schedule
GitHub Actions runs every six hours and can be run manually from Actions → Direct retailer source monitor.
