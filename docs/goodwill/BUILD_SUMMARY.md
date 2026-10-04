# Goodwill Reporting — build summary

> Current authority: [SCOPE.md](SCOPE.md), targeting **joconne8/goodwill_nd**.
> This summary records the earlier runtime/data audit. Its assignment-guide and
> old-repository issue references are historical, not current assignments.

## Purpose and current status

Build one Goodwill Michiana reporting product with three connected layers:
**report acquisition → trusted data and calculations → reporting views**.
The user wants the whole project with four human teammates, not just the current
foundation demonstration, and has identified incomplete use of the available data.

**Coordination: GitHub-first, human-reviewed branches and pull requests.**
Replit provides the working preview and shared implementation. Do not create five
separate applications or assume that publishing a guide launches agents.

The working foundation is synthetic-only and supervised. It generates, downloads,
validates and publishes one unchanged Upright report with persisted totals and
supporting rows. It is **not** the completed acquisition, data pipeline, or
multi-source reporting application.

Read this brief first, then:

- [Foundation contracts, evidence and metrics](FOUNDATION.md)
- [Five-person Codex assignment guide](../../ProjectManagement/agent-assignments/TEAM_ASSIGNMENTS.md)
- [Acquisition handoff](handoffs/acquisition.md)
- [Trusted-data handoff](handoffs/trusted-data.md)
- [Application handoff](handoffs/application.md)
- [Demo and independent acceptance](DEMO.md)

The assignment guide contains the older repository's packet/issue register.
Do not treat those records as assignments in goodwill_nd. Named human allocation
remains proposed pending confirmation.

## Requirements grounded in evidence

Amanda's workflow is repeated report/date selection, generation, past-report
status and download, followed by spreadsheet reporting. Upright retrieval is the
first acquisition target; API access is restricted. Reports can be pulled any day.
Amanda is supported by an assistant. Production AI must be approved and use
Copilot; no production AI integration is authorized by this demo.

The reviewed screenshots support a real-DOM synthetic replica of the report
workflow. They show an order report, while the retained Upright fixture has item
grain. They also show Pacific time, while the demo contract uses Eastern time.
Label those adaptations; do not claim live export compatibility.

Michael Wicks' office-hours guidance informs the three layers and optional
DOM-replica/replay approach. Jev and a universal recorder are not prerequisites,
and their speed, determinism or universal compatibility are not established.

The current acquisition-led synthesis supersedes older dashboard-first plans.
That explains the staged foundation, but it does **not** make omitted dataset
coverage a completed feature.

## Data coverage audit

All 15 base CSVs are retained unchanged under
`docs/goodwill/evidence/github/goodwill/synthetic-data/`.
Counts below were read with Python's CSV parser, not inferred from line counts.
Every business record is fictional. No live Goodwill operating data is connected.

| File | Records | Intended role and constraints | Current runtime use |
|---|---:|---|---|
| `01_cash_monkey_orders_aug2026.csv` | 500 | Book orders, item revenue, refunds and separate payment fees | Not imported |
| `02_upright_paid_order_items_aug2026.csv` | 650 | Paid item rows; gross and item refunds; shipping/tax/fees remain separate | Only report input currently wired |
| `03_jewelry_report_aug2026.csv` | 240 | Weekly batches, appraisal and commissions; supplier exceptions; no buyer key | Not imported |
| `04_shipping_osm_pb_easypost_aug2026.csv` | 3,457 | Postage and signed adjustments; expense ledger, not revenue | Not imported |
| `05_fedex_charges_refunds_aug2026.csv` | 802 | Carrier charges and credits; no actual accounting posting | Not imported |
| `06_shopgoodwill_periodic_reports_aug2026.csv` | 1,800 | Marketplace sales; retain unresolved store attribution | Not imported |
| `07_goodwill_books_payment_statement_aug2026.csv` | 450 | August activity paid September 3; settlement date is not sale date | Not imported |
| `08_ebay_listing_sales_aug2026.csv` | 900 | Sales, quantities, refunds and separate fees; amounts are line totals | Not imported |
| `09_amazon_payments_summary_aug2026.csv` | 650 | Posted activity and settlements; no buyer IDs or invented customer count | Not imported |
| `10_stores.csv` | 24 | Fictional store/district dimension | Not joined into reports |
| `11_listing_events_aug2026.csv` | 3,181 | Listing history includes June/July; filter event time for August metrics | Not imported |
| `12_inventory_snapshots_aug2026.csv` | 6,019 | Three snapshots of a declared two-platform universe; choose one, never sum them | Not imported |
| `13_item_catalog.csv` | 3,900 | Item attributes and lifecycle for ShopGoodwill/eBay drilldown | Not imported |
| `14_quality_exceptions.csv` | 21 | Exact file/data-row exceptions; preserve missing fields, don't silently repair | Not joined into exception views |
| `15_order_lifecycle.csv` | 4,950 | Synthetic fulfillment/refund timing sidecar, not a claimed vendor export schema | Not imported |
| **Base pack total** | **27,544** | Heterogeneous records, not a count of sales or customers | **650 rows used for full-August totals** |

Separate opt-in files are excluded from base totals:

- `test-fixtures/ebay_duplicate_replay.csv`: 25 repeated base rows; prove no inflation.
- `test-fixtures/ebay_invalid_rows.csv`: five invalid rows; prove rejection/accounting.
- `incremental/shopgoodwill_sep01_2026.csv`: 60 new September sales.
- `incremental/ebay_sep01_2026.csv`: 30 new September sales.

The September files are update-demo inputs, not a complete September inventory
or financial close. The generator and manifest are evidence/control tools;
do not regenerate or rewrite the retained source files to make an importer pass.

### What “use all data” must mean

Account for every supplied file in coverage, adapter scope and tests. Valid
transaction inputs, dimensions, expenses, inventory snapshots and deliberately
invalid test cases require different treatment. **Do not concatenate all CSVs or
sum all nine workflows into revenue.** Upright and channel feeds may overlap;
settlements and shipping are not additional sales.

For broader integration, choose the system of record for each metric, approve
cross-source key mappings, retain exact bytes and lineage, and expose unsupported
or incomplete inputs explicitly. Existing fixture source-net/payout columns do
not use the same formula as demo net item sales.

**Open scope decision:** the current P0 is a hardened one-source end-to-end path;
the user has not yet approved whether all valid supplied datasets must also be
implemented in P0. The complete pack is available, so lack of files is not the
reason those base datasets are absent. Approve a broader adapter/metric/UI scope
before calling multi-source coverage complete. Do not silently discard that
request or silently promise nine live integrations.

## Evidence reviewed versus outstanding

- Reviewed: stakeholder interview/staffing correction, current three-phase
  synthesis, repository plans/issues at the recorded checks, merged synthetic
  fixture pack, and Amanda's 17-slide deck with 16 embedded images.
- Listed but not individually reviewed: 25 PNGs in the separate Drive screenshot
  folder. Inspect relevant images before final replica-fidelity decisions.
- Referenced but not adopted/reviewed for the foundation: separate technical
  guide, Granola source links, and external Jev implementations.
- The assignment-guide verification is a later GitHub review, **not** a fresh
  Drive review. Consult [its dated evidence](verification/team-assignments.md).

No previously unreviewed source is made “reviewed” by inclusion in this summary.

## Current executable contracts and metric rules

`lib/api-spec/openapi.yaml` is the source of truth. Generate the React client and
Zod validators; never hand-edit generated outputs.

| Endpoint | Current behavior |
|---|---|
| `POST /api/goodwill/report` | Generates period-filtered Upright CSV and metadata; does not publish |
| `POST /api/goodwill/imports` | Validates the unchanged generated synthetic file and publishes normalized totals |
| `GET /api/goodwill/latest` | Returns the selected single-scope publication or explicit empty state |
| `GET /api/goodwill/sources` | Lists nine workflows; only the Upright synthetic fixture is wired |

USD integer cents; reporting dates use `America/New_York`.
Demo gross = sum of item line sales.
Demo refunds = sum of refunds on those same item rows.
**Demo net item sales = gross − item refunds**, excluding shipping, tax, premiums
and fees. Not payout, margin, or total company revenue. Never multiply line
amounts by quantity again.

Independent reference controls:

| Period (2026) | Rows | Gross | Refunds | Demo net |
|---|---:|---:|---:|---:|
| August 1–31 | 650 | $37,021.26 | $864.16 | $36,157.10 |
| August 1–7 | 141 | $8,041.79 | $450.58 | $7,591.21 |
| August 8–14 | 129 | $6,044.00 | $71.26 | $5,972.74 |

Eight Upright rows lack buyer IDs. Do not substitute row/order count for
customers. Labor productivity, margin, company-wide inventory/sell-through and
other unsupported metrics remain unavailable.

Exact replay retains publication identity and totals. Overlapping report scopes
are separate publications, not cumulative totals. Invalid input cannot replace
last-good data. The current path has **no** immutable raw-byte archive, general
record-overlap engine or approved correction workflow; these are downstream work.

## Team boundaries and build sequence

The five-person guide proposes the following split; humans confirm allocation.

| Lane | Proposed owner | Deliverable |
|---|---|---|
| Lead/shared foundation | Jack OC | Scope, contracts, one scaffold, exact file reservations, human integration |
| Acquisition | Hugh | Screenshot-informed replica, parameterized replay, verified downloaded artifact and bounded failures |
| Trusted data | Peyton | Immutable archive, staged normalization, reconciliation, duplicates/overlaps/corrections, published metrics and coverage |
| Reporting views | Landon | Operations, leadership and finance/source-row evidence views backed by shared APIs |
| Independent QA/demo | Jack mc | Independently derived controls, integrated pass/fail evidence and truthful demo backup |

Lead alone owns OpenAPI/generated clients, manifests/lockfiles, global routes,
entrypoints and shared status. Data owner alone owns new migrations. Feature
owners propose shared interface changes before using them. QA must not modify
financial implementation or fixtures to force acceptance.

1. Accept one foundation/scope/metric baseline; decide broader supplied-data scope.
2. Resolve the existing acquisition contribution and map exact reserved paths.
3. Build acquisition, data and UI in disjoint areas against frozen contracts.
4. Integrate verified acquisition → archive/batch → metric publication → views.
5. Independently verify the complete flow, review failures, then freeze the demo.

The guide's last verified source observation found an existing draft acquisition
PR with a different generated dataset/dates/grain. Review/reuse or an approved
adapter is required; do not duplicate its reservation or silently mix its data.
Recheck that PR's current state before adoption. The Replit scaffold is not
automatically present in GitHub teammates' clones; select and integrate one
accepted baseline first.

## Completion criteria — not satisfied by the foundation alone

- Real browser replay downloads exact CSV bytes for requested parameters.
- File hash and identity trace through archive, batch, rows, metrics and UI.
- Accepted/rejected rows reconcile; blocking exceptions cannot publish.
- Exact repeats and overlapping inputs cannot inflate totals; corrections retain
  history and require reviewed supersession.
- Alternate dates, empty/error/quarantined/stale/missing-coverage states are visible.
- Supporting rows reconcile to published values; the UI does not calculate its
  own conflicting financial truth.
- Every supplied dataset has an honest disposition; each in-scope adapter and
  metric is tested. Deferred coverage is clearly labeled, not presented as done.
- API/import failures retain last-good data without silent fixture fallback.
- Independent integrated browser evidence and demo backup exist.

## Run and verify the existing Replit baseline

Use managed artifact workflows; they inject routing/port configuration:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/goodwill run dev
pnpm run typecheck
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/goodwill run build
pnpm --filter @workspace/api-server exec esbuild tests/goodwill.test.ts \
  --bundle --platform=node --format=esm --outfile=/tmp/goodwill-foundation.test.mjs
(cd artifacts/api-server && node --test /tmp/goodwill-foundation.test.mjs)
(cd docs/goodwill/evidence/github/goodwill/synthetic-data && python -m unittest test_data.py)
python scripts/goodwill-foundation-smoke.py
```

The smoke script uses the development proxy, imports synthetic reports into the
development publication store, and leaves full August selected. It is not a
read-only or production check. Upstream fixture tests do not prove importer/UI
correctness. See [recorded verification](verification/README.md).

## Remaining human decisions and limits

Confirm foundation/metric acceptance, supplied-data scope, named allocation,
baseline integration, existing contribution compatibility, actual deadline,
reviewers and spend limits. Export is currently P1; resolve the QA packet's export
expectation before formal acceptance. No placeholder acceptance records.

GitHub-first supervised work does not require testing Replit's unattended task
runner. If unattended execution is later chosen, verify review/apply/cancel,
deadline and spending controls first; instruction checkpoints are not enforced
limits. Separate memberships do not establish pooled credits.

No live marketplace credentials, restriction bypass, production DB change,
unapproved model provider, accounting posting, autonomous merge or publishing is
authorized by this summary. No downstream lane or external issue action is
launched by writing it.