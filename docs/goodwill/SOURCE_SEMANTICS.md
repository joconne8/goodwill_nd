# Source semantics — unchanged synthetic pack

All names below are the supplied CSV filename prefixes; see the target
`synthetic-data/` README and manifest for exact original headers. Runtime currently
uses the bundled content-equivalent copy under `docs/goodwill/evidence/github/goodwill/`.
The target original remains authoritative; never run its generator as a migration.
The fixture-identity check compares every bundled file against target Git blob IDs.
The earlier repository snapshot uses CRLF CSV endings; goodwill_nd uses LF.
Only that documented newline difference is accepted. Raw uploaded-file hashes
always cover exact bytes, without normalization.

All financial amounts are USD decimal strings → integer cents. All amounts are
line totals, not unit prices. All source identities are independent.
There is no approved system-of-record mapping permitting additive cross-source
revenue. Even a matching order-looking ID does not authorize such a join.

| File / rows | Dataset / source / report | Grain and stable identity | Time and metric role |
|---|---|---|---|
| 01 / 500 | cash_monkey / cash_monkey / orders | order_id + sku | order_date, sales; item_revenue − refund_amount; payout kept separate |
| 02 / 650 | upright / upright / paid_order_items | paid_order_id + item_id | paid_at Eastern, sales; gross_sales − refund_amount |
| 03 / 240 | jewelry / jewelry / jewelry_report | jewelry_batch_id + item_id | sale_date, jewelry activity; gross_sales and source net_sales; no invented buyer/refund facts |
| 04 / 3,457 | shipping / shipping / shipping_transactions | provider + account + transaction_id | ship_date, expense = postage_amount + signed adjustment_amount |
| 05 / 802 | fedex / fedex / charges_refunds | transaction_id | ship_date, expense = charge_amount − refund_amount; store attribution unavailable unless an explicit reviewed relation exists |
| 06 / 1,800 | shopgoodwill / shopgoodwill / periodic_sales | order_id + item_id | sale_date; net items = gross_sales − refund_amount; customer identity local |
| 07 / 450 | goodwill_books / goodwill_books / payment_statement | statement_id + order_id + isbn | statement_month period sales, payment_date settlement; daily order activity unavailable from this base file |
| 08 / 900 | ebay / ebay / listing_sales | transaction_id | sale_date; sale_amount − refund_amount; quantity not a multiplier |
| 09 / 650 | amazon / amazon / payments_summary | settlement_id + amazon_order_id + sku | posted_date settlement activity; product_sales − refunds is posted item activity, not order-day sales; no buyer IDs |
| 10 / 24 | stores / reference / stores | store_id | store name/district/currency/timezone; unknown references remain unknown |
| 11 / 3,181 | listings / operations / listing_events | platform + listing_id (source_row_id lineage) | listed_at includes June/July history; distinct listings within requested dates, not sale counts or relisted flag sums |
| 12 / 6,019 | inventory / operations / inventory_snapshots | snapshot_at + item_id | one of three snapshot instants; selected declared catalog universe only |
| 13 / 3,900 | catalog / reference / item_catalog | item_id + platform | dimension and declared inventory universe; received/listed/sold/canceled timestamps support snapshot checks, not fabricated base-source fields |
| 14 / 21 | exceptions / reference / quality_exceptions | source_file + source_row_id + field | declared synthetic expected exceptions; not a substitute for validation |
| 15 / 4,950 | lifecycle / reference / order_lifecycle | source_file + source_row_id | synthetic sidecar supplies order/ship/refund dates and currency; never imply these columns are in live exports |

## Monetary field dictionary

Preserve original named amounts in typed source ledgers and expose them as evidence:

- CashMonkey: item_revenue, shipping_revenue, refund_amount, payment_fee,
  payout_amount = item + shipping − refund − fee.
- Upright: gross_sales, shipping_collected, sales_tax, marketplace_fee,
  refund_amount, net_sales = gross + shipping − refund. The source net field
  does **not** subtract marketplace_fee and must not be silently relabelled.
- Jewelry: gross_sales, appraisal_fee, commission_fee,
  net_sales = gross − appraisal − commission. Unconfirmed supplier remains flagged.
- OSM/PB/EasyPost: postage_amount, adjustment_amount (signed).
- FedEx: charge_amount, refund_amount, net_amount = charge − refund.
- ShopGoodwill: gross_sales, buyer_premium, shipping_collected, tax_collected,
  refund_amount, net_sales = gross + premium + shipping − refund.
- Books: gross_sales, marketplace_fee, shipping_credit, refund_amount,
  net_payout = gross + shipping − refund − fee.
- eBay: sale_amount, shipping_paid, tax_collected, ebay_fee, refund_amount,
  payout_amount = sale + shipping − refund − fee.
- Amazon: product_sales, shipping_credits, promo_rebates, selling_fees,
  fba_or_shipping_fees, refunds, net_proceeds = product + shipping − rebates −
  selling fees − fulfilment fees − refunds.

Tax, shipping, premium and fees never enter net-item-sales just because they appear
in a source net field. Expense ledgers never enter revenue.

## Coverage, sidecars and exceptions

Base business files cover August 2026 synthetic activity. Books payment is
September 3 but its statement is August; do not move those sales to September.
Snapshots are August 1, 15 and 31 at 23:59:59 Eastern, each a separate universe:
respectively 2,577/2,196/1,246 inventory rows and 832/757/765 unlisted items.
Unlisted states: received, awaiting_inspection, awaiting_photography, ready_to_list.
No three-snapshot aggregate. Compare item identities to declared catalog scope
and manifest controls before claiming completeness; importing only a subset does
not make a complete snapshot.

Listings/platform operations support ShopGoodwill and eBay. Do not project these
across the other sources. Missing buyer is a flag affecting customers, not sales.
Unknown/missing store stays in the Unknown bucket. Retain original nulls and
unconfirmed suppliers. Sidecar corrections are labelled synthetic enrichment;
do not infer a production join or suppress deliberate exception cases.

| Non-base input | Deliberate disposition |
|---|---|
| manifest.json | Independent fixture controls, explicit snapshot scopes, coverage and conventions; not a sales ledger or uploaded report |
| incremental/ebay_sep01_2026.csv | Opt-in 30-row September 1 coverage; common eBay parser; excluded from August |
| incremental/shopgoodwill_sep01_2026.csv | Opt-in 60-row September 1 coverage; common ShopGoodwill parser; excluded from August |
| test-fixtures/ebay_duplicate_replay.csv | Opt-in idempotency test; same source keys must not add revenue |
| test-fixtures/ebay_invalid_rows.csv | Opt-in rejection/reconciliation test; invalid rows must not contribute |
| generate.py | Upstream deterministic generator, reference only; do not regenerate supplied inputs |
| test_data.py | Upstream control regression, runs against unchanged files |
| README.md / .gitignore | Upstream explanatory/reference files, not intake data |

## Required independent financial controls

August net item cents from Decimal re-summing original columns, not application code:
CashMonkey 1,032,846; Upright 3,615,710; ShopGoodwill 11,126,218;
Books statement 918,493; eBay 5,551,526; Amazon posted item activity 1,306,005.
These are separate controls, not additive revenue.
Jewelry source net 1,799,730; shipping expense 3,281,419; FedEx expense 2,012,104.
Additional daily/customer/listing controls are in the supplied manifest and
must be independently recomputed by QA without importing application metric code.