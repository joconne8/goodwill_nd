# Goodwill synthetic enterprise source data

**SYNTHETIC DEMO DATA — every business record is fictional.** These are proposed
adapter fixtures, not verified marketplace exports, actual Goodwill operating
volumes, production connections, or an approved accounting import.

This pack replaces the original ten-row examples with **27,544 base CSV records**:
5,190 sales/statement lines, 4,259 shipping expense lines, and linked reference,
listing, inventory, lifecycle, and exception records. The original nine filenames
and column headers are retained; their example rows and IDs are replaced, not
appended. Rebuild/reset any database seeded with the old examples.

## Coverage and entry points

Reporting month: **August 2026**. Financial activity is modeled as known through
August 31 at 23:59:59 Eastern. USD only; timestamps use the explicit summer
`-04:00` offset. Date-only source fields are local reporting dates. Buyer IDs are
opaque, platform-local synthetic IDs; there are no names, emails, addresses,
payment credentials, or employee records.

| File | Rows | Purpose |
| --- | ---: | --- |
| `01_cash_monkey_orders_aug2026.csv` | 500 | Book orders, bundles, refunds, payment fees |
| `02_upright_paid_order_items_aug2026.csv` | 650 | Paid item lines, shipping, fees, missing buyer examples |
| `03_jewelry_report_aug2026.csv` | 240 | Weekly appraisal/commission batches, unconfirmed supplier examples |
| `04_shipping_osm_pb_easypost_aug2026.csv` | 3,457 | Linked postage expenses and positive/negative adjustments |
| `05_fedex_charges_refunds_aug2026.csv` | 802 | Linked weekly carrier invoices and charge credits |
| `06_shopgoodwill_periodic_reports_aug2026.csv` | 1,800 | Daily marketplace activity; deliberately unresolved stores |
| `07_goodwill_books_payment_statement_aug2026.csv` | 450 | August statement with September 3 payment date |
| `08_ebay_listing_sales_aug2026.csv` | 900 | Paid sales, fees, item quantities, refunds, relist flag |
| `09_amazon_payments_summary_aug2026.csv` | 650 | Posted financial activity, settlement groups, promotions, refunds |
| `10_stores.csv` | 24 | Fictional store dimension, districts, currency, timezone |
| `11_listing_events_aug2026.csv` | 3,181 | ShopGoodwill/eBay listing history for the August inventory universe |
| `12_inventory_snapshots_aug2026.csv` | 6,019 | Complete declared-universe snapshots on August 1, 15, and 31 |
| `13_item_catalog.csv` | 3,900 | Two-platform item titles, condition, receipt/listing/sale/cancellation times |
| `14_quality_exceptions.csv` | 21 | Exact file/data-row references for intentional missing fields |
| `15_order_lifecycle.csv` | 4,950 | Linked synthetic order/fulfillment/refund timing for non-jewelry sources |

Start the four-view weekend demo with files **06, 08, 10, 11, and 12**. Use 13 for
item drilldown, 14 for exception drilldown, and `manifest.json` as the reconciliation
oracle. The other source formats support future adapter work; this does **not**
expand the [PRD](../PRD.md)'s two-platform application commitment.

## What makes the records more believable

- Uneven volumes across all 24 fictional stores, nine merchandise categories,
  right-skewed prices, rare high-value donations, and descriptive used-item titles.
- Every August day has ShopGoodwill and eBay sales; weekends and month-end have
  modest synthetic demand effects rather than identical daily totals.
- Buyer pools create repeat customers, including multiple same-day purchases.
  Some orders contain bundles/multiple units; financial values are **line totals**,
  not unit prices to multiply by `quantity`.
- Partial refunds, full pre-fulfillment cancellations, pickup/free-shipping
  transactions, promotions, relist flags, postage adjustments, and carrier credits.
- Shipping occurs after the modeled order date, on a business day, with a
  1–5-day base fulfillment lag rolled forward over weekends. Each fulfilled order
  has one expense line in one carrier file; no orphan shipping order IDs.
- Late-August orders can remain pending at close; canceled orders and local
  pickups have no postage line. Full cancellations return two-platform inventory
  to inspection/ready-to-list states, rather than disappearing from backlog.
- The books statement separates August activity from September payment.
  Amazon has posted activity dates and settlement groups, not invented buyer IDs.

All volume profiles, fee rates, premiums, tax scenarios, shipping lags, supplier
arrangements, GL numbers, and cost centers are **demo assumptions**, not claims
about Goodwill or any platform. The retained ShopGoodwill `buyer_premium` column
and modeled 10% rate are inherited fixture conventions, not verified marketplace
policy. Jewelry uses a fictional `Demo Jewelry Partner`. FedEx `bc_deposit_id`
is intentionally empty: no actual Business Central posting exists.

## Metric and accounting contracts

The PRD takes precedence over the older example README:

- **Core net item revenue = gross item sales − item refunds**, excluding tax,
  shipping, premiums, and fees. Use `gross_sales - refund_amount` for ShopGoodwill
  and `sale_amount - refund_amount` for eBay. Refunds are attached to original
  sale rows as known at close; this is not a refund-date cash-flow report.
- Source fields named `net_sales`, `payout_amount`, or `net_proceeds` preserve
  their existing fixture-specific formulas. They are **not interchangeable**
  with the dashboard's net item revenue.
- Customers are distinct non-empty buyer IDs **per platform per sale day**.
  Do not merge buyer identities across platforms or use payment/posted dates as
  order dates. Amazon has no buyer ID. Jewelry has no buyer key. Goodwill Books
  exposes a statement/payment date, not a daily sale date.
- Missing-store rows remain included in platform/day totals in an unresolved
  store bucket, not silently assigned to a store or dropped. If an importer
  quarantines them, reconcile accepted totals plus exception totals.
- Fees and shipping costs are separate ledgers. Do not count shipment rows as
  sales, add shipping expenses to revenue, or infer profit without an agreed
  cost definition. Net proceeds can be negative for a full refund with retained
  fees; this is intentional.
- No labor productivity, enterprise-wide sell-through, cross-platform customer
  total, or approved Business Central journal is implied by this dataset.

| Source | Existing fixture formula |
| --- | --- |
| Cash Monkey | `payout_amount = item_revenue + shipping_revenue - refund_amount - payment_fee` |
| Upright | `net_sales = gross_sales + shipping_collected - refund_amount` |
| Jewelry | `net_sales = gross_sales - appraisal_fee - commission_fee` |
| ShopGoodwill | `net_sales = gross_sales + buyer_premium + shipping_collected - refund_amount` |
| Goodwill Books | `net_payout = gross_sales + shipping_credit - refund_amount - marketplace_fee` |
| eBay | `payout_amount = sale_amount + shipping_paid - refund_amount - ebay_fee` |
| Amazon | `net_proceeds = product_sales + shipping_credits - promo_rebates - selling_fees - fba_or_shipping_fees - refunds` |
| FedEx | `net_amount = charge_amount - refund_amount` |
| Other shipping | Expense is `postage_amount + adjustment_amount` |

Amounts are generated with decimal, cent-level rounding. Collected taxes are
excluded from these source-net formulas. These conventions need remapping and
confirmation before any production use.

## Listing and inventory semantics

`11_listing_events_aug2026.csv` is named for the reporting pack, but contains
June/July listing history as well as August events: older listings can sell in
August. **Filter `listed_at` to August** for August's listing count. A listing
row represents the modeled current listing event, not a complete relist history;
the eBay `relisted` flag must not be counted as an extra event.

The catalog's universe is 2,700 August sold-item records plus 1,200 unsold/pipeline
items on ShopGoodwill/eBay. Each snapshot includes all received items in this
declared universe that have not sold by its cutoff, plus canceled items returned
to the pipeline. This is complete **for this fixture universe only**, not a claim
about all 24 stores' actual physical inventory or the other seven source workflows.

Unlisted states are `received`, `awaiting_inspection`, `awaiting_photography`, and
`ready_to_list`. `listed` is not backlog. Use one selected snapshot; do not sum
snapshots or infer backlog from sales alone. The catalog `sold_at` is the modeled
paid-sale event; `canceled_at` reverses its inventory removal. There is no claimed
physical return history for partial refunds.

`15_order_lifecycle.csv` is a **synthetic sidecar**, not fields asserted to exist
in actual source exports. It provides modeled order dates for fulfillment joins,
including books whose original statement lacks them. September incremental
sales intentionally have no matching catalog/listing/snapshot shipment package;
use them for the sales/revenue update demo, not a complete September close.

## Exceptions and replay scenarios

Base CSVs have valid dates/numbers and unique primary IDs. Intentional missing
fields are enumerated in `14_quality_exceptions.csv`:

- 8 ShopGoodwill rows have missing stores. Missing attribution is propagated to
  catalog, listing, and shipping records, not repaired from hidden assumptions.
- 8 Upright rows have missing buyer IDs. Mark customer coverage incomplete for
  affected inputs rather than substituting order count.
- 5 jewelry rows have missing/unconfirmed suppliers.

Additional CSVs are **opt-in test/demo inputs**, excluded from base control totals:

- `test-fixtures/ebay_duplicate_replay.csv`: 25 exact copies of accepted base
  rows. Re-importing must not create sales or change totals.
- `test-fixtures/ebay_invalid_rows.csv`: five rows expected to be rejected for
  invalid date, negative gross sales, missing transaction ID, nonnumeric sales,
  or refund greater than original item sales. These also have stale copied net
  fields; rejection should precede metric aggregation.
- `incremental/shopgoodwill_sep01_2026.csv`: 60 new sales with distinct IDs.
- `incremental/ebay_sep01_2026.csv`: 30 new sales with distinct IDs.

Provenance convention: `source_row_id` in the exception/lifecycle sidecars is
the **1-based data row**, excluding the header; its file name completes the key.
Listing/inventory `source_row_id` values are stable fixture IDs. Re-import
fingerprints should include file content, not rely on filename alone.

## Rebuild and verify

Python 3.10+; standard library only. From the repository root:

```sh
python3 goodwill/synthetic-data/generate.py
python3 -m unittest discover -s goodwill/synthetic-data -p 'test_*.py' -v
```

The fixed seed `260803` makes repeated generation byte-identical. Running the
generator **overwrites these generated CSVs and `manifest.json`**. Edit the
generator, not generated rows, for durable fixture changes.

`manifest.json` records file hashes/row counts, cent-exact source control totals,
62 daily core-metric records, three inventory controls, and exception counts.
The test suite checks schema compatibility, financial arithmetic, unique IDs,
24-store coverage, shipping joins/dates, inventory completeness and lifecycle
ordering, repeat buyers, exception coverage, incremental isolation, ISBN
checksums, and deterministic regeneration.

These checks verify **fixture integrity**, not that the application's import,
deduplication, rejection handling, dashboards, or accounting integrations work.
Use the replay fixtures and manifest to test those implementations separately.

