# Reporting application handoff

This is the application lane of the full Goodwill repository build, not a claim
that the whole repository, shared integration or production delivery is complete.
The existing foundation, shared shell/routes, backend, schemas, fixtures,
dependencies, artifact configuration and acquisition implementation are unchanged.

## Implemented surfaces

| Surface | Working behavior |
|---|---|
| Operations | Simulated Upright run initiation, scenario selection, bounded retry/cancel/download/import controls; polling and paginated server run history. Common ticket → original-byte PUT → intake for all 15 declared datasets. Explicit synthetic confirmation and 5 MiB bound. Persistent batch history with source/state filters. |
| Leadership/reporting | Nine business-source choices; one source per query; inclusive Eastern dates; real store dimension and explicit Unknown attribution; day/store/category/none breakdowns; backend net items, source payout/net and carrier expense kept separate. |
| Daily customers | Platform/day distinct buyers and missing-buyer counts from the backend. Multi-day aggregate remains null. No cross-platform identity or additive daily/store distinct totals. |
| Listings | Distinct new-listing events for eBay or ShopGoodwill, not sale rows or relists. Explicit period controls preserve access to June/July history. |
| Backlog | One explicitly entered offset-bearing source snapshot timestamp; no query before selection; backend catalog/control-universe completeness gate. Missing/partial snapshot is unavailable, not zero. |
| Finance evidence | Exact selected query and immutable publication; paginated source ordinals, normalized/source string values, batch/run/artifact/checksum lineage and reasons. Never substitutes a newly published revision for a pinned figure. |
| Reconciliation/review | Backend expected/actual/difference controls; accepted/rejected/duplicate counts; disposition-filtered rows; rejection export; correction approval or rejection with reason, synthetic confirmation and expected immutable revision. Revision refresh clears confirmation; confirmation/submission are disabled during refresh. 409 is visible and never retried automatically. |
| Definitions | All nine business and six supporting datasets, roles, grains, time bases, coverage and metric definitions from the real catalog. Explicit synthetic, replica, non-production and informational-persona disclosures. |
| CSV | Summary/evidence pin the exact displayed query/publication; rejection CSV pins batch ID. Server creates CSV and protects formulas. Client formats display values only; it does not recalculate financial totals. |

Both dataset coverage and last-good/latest-attempt timestamps remain visible.
Quarantined/failed/duplicate/superseded attempts are distinct from publication.
Every query has an explicit loading, error and empty/unavailable state.
Mutable data has polling/refetch paths; successful mutations invalidate affected
history, detail, catalog and metric queries. Selected evidence stays immutable.

Books requires a complete statement-month query and a non-day breakdown. Its
September payment is not September sales. Amazon posted activity is not order-day
customer activity. Jewelry has its source-net definition, not a fabricated net
item sales metric. FedEx has no approved named-store attribution. These are
backend constraints, disclosed rather than bypassed by the UI.

## Exact new paths

Under `artifacts/goodwill/src/features/reporting/`:

- `ReportingApp.tsx` — integration entry and six views.
- `ReportingShell.tsx`, `ui.tsx`, `reporting.css` — scoped presentation/accessibility.
- `MetricView.tsx` — query figures, backend breakdowns, coverage and pinned exports.
- `EvidenceView.tsx` — immutable evidence and pagination.
- `OperationsView.tsx` — acquisition controls, common upload and history.
- `BatchDetail.tsx` — reconciliation, row dispositions and correction review.
- `model.ts`, `index.ts` — display/boundary helpers and component exports.
- `inspection.html`, `inspection.tsx` — **development inspection only**, not a
  production entry or replacement for the retained foundation.

Under `artifacts/goodwill/src/features/reporting-tests/`:
`model.test.ts`, `browser.test.ts`, `run.mjs`.

Under `docs/goodwill/application/evidence/`:
`browser-controls.json`, `reporting-desktop.png`, `reporting-mobile.png`.

## Lead-owned integration requested

1. Mount exported `ReportingApp` in the existing shell, for example a `/reports`
   Wouter route under the existing `QueryClientProvider`, and add the navigation
   link. Keep legacy Home runnable. Component navigation uses URL hashes; actual
   shared routing is not changed in this lane.
2. At shared bootstrap, use the generated client's base-path configuration:
   `setBaseUrl(import.meta.env.BASE_URL.replace(/\/$/, '') || null)`.
   Preserve session-based web authorization; do not invent persona permissions or
   use a web bearer-token getter as an authorization workaround.
3. Mount the data and acquisition routers at the frozen `/api/goodwill/v2`
   interface with the real authorized-operator callback and persisted adapters.
   Wire verified runs to common intake. No UI test stub belongs in this runtime.
4. Resolve the existing private-storage setup, permanent-schema and restart
   gates; apply only reviewed lead-owned schema/configuration changes.
5. Fix/review the existing data-service defect: identical bytes first submitted
   under an incorrect period can be suppressed by a quarantined checksum on a
   corrected-period retry, yielding a duplicate with no publication. The UI
   discloses that outcome; it does **not** alter bytes or spoof identity to hide it.
6. Run independent complete-delivery QA after integration. No human teammate
   approval, production role enforcement, live vendor acceptance, approved AI or
   Business Central posting is claimed.

The inspection URL is `/src/features/reporting/inspection.html` relative to the
managed Goodwill preview. In the current shared app, missing v2 mounting produces
an explicit error. No example, fixture or successful-looking fallback is shown.
The production build does not include this development HTML entry.

## Verification

Passed application typecheck:

```sh
pnpm --filter @workspace/goodwill typecheck
```

Passed **6 tests, 0 failures/skips** (5 boundary tests and one comprehensive
real-browser scenario):

```sh
GOODWILL_PLAYWRIGHT_MODULE=/mnt/pid2/node_modules/playwright/index.mjs \
GOODWILL_CHROMIUM=/repl/tools/bin/chromium \
node artifacts/goodwill/src/features/reporting-tests/run.mjs
```

On another environment, supply approved available Playwright/browser paths; do
not assume these environment-provided paths exist. The browser test requires the
managed Goodwill web workflow and `REPLIT_DEV_DOMAIN`. Unit-only checks use
`node artifacts/goodwill/src/features/reporting-tests/run.mjs --unit`.

The browser scenario reads the unchanged original 15-input pack, explicitly seeds
it into a **test-only** repository/archive, and calls the actual data Router,
normalization, reporting, review and export services. An independent Python
original-file oracle checks **15 source-local financial controls** across net
items, source net and carrier expense. Expected cents and actual formatted figures
are in `evidence/browser-controls.json`; no cross-source sum is computed.

Also verified in that scenario:

- 24 real stores plus All/Unknown; all 15 intake options and dataset definitions.
- Backend daily customer points exactly match the independent platform/day oracle.
- Source/store/group filters, listing control and a selected complete snapshot;
  a nonexistent snapshot is unavailable.
- Actual browser summary/evidence/rejection CSV downloads and immutable revision
  pins, including evidence pagination.
- Exact original bytes in the test upload inbox; duplicate attempts disclosed.
- Full-original-period/key-set correction, stale-review 409, explicit refreshed
  confirmation, successful supersession and explicit rejection without changing
  the approved financial value.
- History after page reload, superseded-state filtering, 390-pixel layout without
  body overflow, desktop layout and zero uncaught page errors.
- Visible 503/401 states with no fixture fallback or displayed manufactured zero.

Acquisition run history is an **empty UI contract stub only in this test**. This
scenario does not certify browser acquisition, retry/cancel automation, real
cloud PUT/CORS/retention, production authorization or database durability/restart.
Those remain acquisition/shared integration and independent QA responsibilities.
The runtime reporting modules import no test helpers or fixture files.

The real managed inspection was visually checked and truthfully showed the
missing-v2-service state. Loaded desktop/mobile screenshots are from the explicit
test harness, not a claim of live production data.