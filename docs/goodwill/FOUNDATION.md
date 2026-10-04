# Goodwill shared foundation — contract 1.0.0

> Historical thin-slice record. Current scope, repository and parallel contracts
> are in [SCOPE.md](SCOPE.md). The broader build includes eligible second-source,
> customer, listing, backlog, export and history work now, not optional deferral.

Status: technically established supervised baseline; lead scope acceptance remains open. The user selected GitHub-first human coordination; unattended runner verification is conditional, not a prerequisite for supervised GitHub work. This document freezes proposed implementation boundaries, not a claim of partner approval. No downstream lane has been launched here.

Start with [BUILD_SUMMARY.md](BUILD_SUMMARY.md) for the complete supplied-data coverage audit, current gaps and five-person handoff. The running foundation consumes only one of 15 base CSVs; it is not completion of the user's whole-project request.

## Authority and reviewed evidence

Current user decisions → primary stakeholder evidence → current Drive three-phase synthesis → accepted local contracts → repository issue implementation plans → legacy PRDs. Material reviewed from the authorized repository `joconne8/sprinthack-nd-2026` and authorized Drive on October 3, 2026 Eastern / October 4 UTC.

| Evidence | Review outcome |
|---|---|
| Repository main recursive tree; all 44 issue/PR records; repository-wide issue comments | Reviewed. 43 open issue records and one closed PR; comment endpoint returned no comments. An open issue is not evidence of completed code. |
| PR 1, expanded synthetic dataset | Verified merged at 2026-10-04T00:13:02Z and present on main. Issue DAT-01 and source register calling it draft/unmerged are stale. Do not recreate this contribution. |
| Current Drive three-phase plan | Governs acquisition-led P0; not the older four-view/two-platform promise. |
| Amanda interview; Amanda2.0 staffing correction | Upright retrieval first; repeated report/date workflow; API access restricted. Reports can be pulled any day. Amanda is now supported by an assistant, not the departed e-commerce manager. Production AI must be approved and use Copilot. |
| Michael Wicks office hours; Jack explanation | Three connected layers; DOM replica/replay suggested. Claims that Jev is deterministic, token-free, universally compatible or guaranteed nine seconds are not established. A recorder is optional, not a prerequisite. |
| Corrected brief | Synthetic weekend data; reuse existing paid tools; authorized retrieval. Planned Sunday October 4 freeze 4pm Eastern and Pod B presentation 4:30pm require event confirmation. |
| README, goodwill PRD, deck extract, source register, scope PRD, legacy agentic plan/recommendation, problem discussion | Reviewed as context. Older Beacon recommendation is superseded by the user's Goodwill choice. Older dashboard-first PRD does not override the current synthesis. |
| All 15 merged synthetic CSVs, manifest, deterministic generator, existing test suite and negative/replay fixtures | Retrieved unchanged into `evidence/github/goodwill/synthetic-data/`. Existing tests run without regenerating files. |
| Amanda PowerPoint (17 slides, 16 embedded images) | Retrieved; all slide text extracted and all images visually reviewed in a contact sheet. Enlarged date form and email modal inspected. References reside in `attached_assets/goodwill-reference/`. |
| Separate Drive screenshot folder | Listed 25 PNGs; its individual images have **not** been reviewed. Do not claim its contents were inspected. Acquisition owner should inspect relevant images before fidelity decisions. |
| Separate technical guide, Granola source links, external Jev implementations | Referenced by the plan, not reviewed or adopted for this foundation. Not needed for deterministic synthetic baseline. |

Initial concurrent Drive content requests hit a connector rate limit; all five failed text reads were subsequently retried sequentially and succeeded. No access failure is being concealed as a reviewed source.

### Observed visual workflow and discrepancies

Amanda's images show Reports → Paid orders → date range → channel/payment filters → Generate report → optional email-address modal → confirmation → past-report status/link → Download → spreadsheet/daily summary. Cash Monkey images show eBooks Open Cash Money Reports → Orders Report → dates → report link/download.

The displayed Upright screenshot uses **Paid Order Report**, while the chosen synthetic fixture is **paid-order-item grain**; live exported columns/grain are not confirmed. The pictured timezone is Pacific, while this demo deliberately uses Eastern. Instruction text and pictured dates also differ. Do not copy screenshot dates/timezone into the accounting contract or infer live compatibility. The later replica should label the item-grain demo adaptation explicitly. The slide's spreadsheet row-count customer convention is not a validated unique-customer metric.

## Accepted-scope proposal

### Foundation checkpoint (implemented here)

One existing React/Vite application and the existing Express/PostgreSQL API. Select an August 2026 period, generate a CSV filtered from the merged Upright fixture, download it, explicitly choose the unchanged file, validate it and publish a basic total with file/source/row identity. Show missing coverage and unavailable metrics. Successful normalized publications persist across reloads and sessions.

This is supervised manual acquisition, not the completed browser replica or reliable acquisition task. The public API is synthetic-only, unauthenticated and not a production deployment.

### Downstream integrated P0

1. One screenshot-informed, real-DOM Upright-style synthetic replica.
2. Parameterized deterministic browser replay yielding an actual verified downloaded artifact.
3. Immutable raw archive, staged normalization, reconciliation, versioned metric publication, file/record/overlap protection, controlled corrections and last-good behavior.
4. Operations/leadership/finance evidence views showing that same acquired file, period, freshness, coverage, actionable failures and supporting rows.
5. Alternate dates, exact replay and failed acquisition/import demonstrated without fabricated totals.

P1 only after P0 passes: second synthetic source, richer/four-view dashboard, Excel-compatible export, approved bounded read-only assistant, measured optional Jev comparison. P2/out: universal recorder, nine live integrations, production Copilot, autonomous close/marketplace/accounting actions.

## Metric dictionary

| Metric | Formula / grain / availability |
|---|---|
| Demo gross item sales | Sum `gross_sales` once per paid-order-item row. Line totals, never multiplied by quantity. |
| Demo item refunds | Sum `refund_amount` recorded on the same item rows; nonnegative. This is not a separate refund-date accounting ledger. |
| Demo net item sales | Gross item sales minus item refunds. Exclude shipping collected, sales tax, premiums and fees. Not payout, net margin, or total company revenue. |
| Accepted rows | Count validated item rows; not orders, units or customers. |
| Customer count | Unavailable in this foundation. Eight full-month Upright rows have missing buyer IDs; no estimates. Future counts need marketplace-local keys and declared completeness. |
| Revenue/labor hour | Requires period-aligned labor hours and explicit revenue convention; otherwise unavailable. |
| Margin / net margin | Requires approved costs, fees and allocation convention; otherwise unavailable. |
| Sell-through | Requires declared inventory universe and complete opening/closing or listing cohort denominator; otherwise unavailable. The in-store 50–55% reference is not an e-commerce target. |
| Growth, budget, productivity and backlog | Require comparable approved prior periods/budgets/intake/listing events; not inferred from one file. |

Currency USD; financial calculations use integer cents parsed from exactly two-place decimals. Eastern inclusive reporting dates come from `paid_at` instants, not UTC date truncation. Preserve source raw payout/net-sales fields separately in the future data lane: they use a different formula.

Independent oracle, calculated with Python `csv` + `Decimal`, not copied from the server:

| Period | Rows | Gross | Refunds | Demo net |
|---|---:|---:|---:|---:|
| August 1–31 | 650 | $37,021.26 | $864.16 | $36,157.10 |
| August 1–7 | 141 | $8,041.79 | $450.58 | $7,591.21 |
| August 8–14 | 129 | $6,044.00 | $71.26 | $5,972.74 |

Original Upright fixture SHA-256: `3ffd1bdae4a5f79d25788120833be99499b05791a255fcfd2f7b378254d5a1ab`. Generated period files are serialized separately and carry their own exact UTF-8 SHA-256. Never substitute this original-fixture hash for a filtered download hash.

## Nine-source matrix

These are source **workflows**, not nine additive revenue feeds. Acquisition classifications below are evidence-backed where known and provisional elsewhere; validate provider format/access before live use.

| Workflow | Reusable acquisition class | Source-specific grain/role | Foundation status |
|---|---|---|---|
| Upright | Browser CSV | Paid item rows; potential overlap with channel reports | Synthetic fixture only |
| Cash Monkey | Browser CSV | Book-order sales | Not connected; fixture available |
| Jewelry | Weekly delivered/uploaded report | Appraisal/sales/commission batch; supplier not confirmed | Not connected |
| OSM/Pitney Bowes/EasyPost | Carrier export/delivered file; delivery method to confirm | Shipping expenses/adjustments, not revenue | Not connected |
| FedEx | Weekly invoice/credit | Shipping charges/refunds, not revenue | Not connected |
| ShopGoodwill | Periodic portal report | Marketplace sales; potential Upright overlap | Not connected |
| Goodwill Books | Monthly statement | Activity period distinct from payment/settlement date | Not connected |
| eBay | Listing/sales portal export | Item sales/quantity/fees/refunds; potential Upright overlap | Not connected |
| Amazon | Payments-summary portal export | Posted financial activity/settlements, no invented buyer IDs | Not connected |

Do not sum all workflows. Choose a metric-specific system of record and reviewed key mappings before any multi-source rollup. Shared acquisition mechanisms do not imply shared parsers.

## Runtime contracts and semantics

`lib/api-spec/openapi.yaml` is the executable contract; Orval generates the client and Zod validators. Contract version `1.0.0`; metric definition `demo-net-item-sales/1.0.0`. Do not hand-edit generated files.

| Endpoint | Input / result |
|---|---|
| `POST /api/goodwill/report` | `ReportPeriod` → `SyntheticReport` containing exact CSV text, filename, source/type, dates, checksum and explicit synthetic/version flags. Does not publish. |
| `POST /api/goodwill/imports` | `SyntheticReport` → `ReportingResult`. Server validates bytes, schema, keys, money, timestamps and declared period before any write; foundation additionally accepts only its unchanged generated fixture output. |
| `GET /api/goodwill/latest` | `{result:null}` until a successful publication, then the single-scope result selected by the last successful import. Never an aggregate of overlapping report files. |
| `GET /api/goodwill/sources` | Nine source workflow records and honest connection states. |

`ReportingResult` includes publication ID/time, source/report/file/checksum/period, definition/version, timezone/currency, integer totals, coverage, warnings and normalized supporting rows. Data `sourceRow` is one-based **data row**, excluding header; quoted multiline CSV does not change that meaning. Raw CSV is transient here, not stored as PostgreSQL bytes. The data lane must introduce immutable App Storage archival and link the returned object path to queryable lineage.

Exact source/report/period/definition replay returns the original publication without new totals, ID or publication timestamp, and re-selects it as the shared current result. The database uniquely reserves this exact scope. Overlapping periods remain separate publications; latest displays one selected scope, not their sum. This is **not** the full record-level deduplication/overlap/correction engine.

Malformed/mismatched/unsupported/empty/out-of-period/duplicate-row imports cannot publish or change last-good data. Alternate bytes are not silently accepted. Corrected files require review and a later controlled supersession contract. No destructive replacement or automatic correction approval.

Errors return `{code,error}`. Validated client mistakes: `INVALID_PERIOD`, `UNSUPPORTED_PERIOD`, `INVALID_REPORT`, `CHECKSUM_MISMATCH`, `INVALID_HEADER`, `MALFORMED_CSV`, `EMPTY_REPORT`, `INVALID_IDENTITY`, `DUPLICATE_ROW`, `INVALID_TIMESTAMP`, `WRONG_PERIOD`, `INVALID_AMOUNT`, `INVALID_REFUND`, `UNKNOWN_SYNTHETIC_REPORT`, `CORRECTION_REQUIRES_REVIEW`. Oversize input is HTTP 413 / `REPORT_TOO_LARGE`; invalid JSON is 400 / `INVALID_JSON`; storage failures are 503 / `STORAGE_UNAVAILABLE`, not empty success. A failed request has no published result. These failure response shapes are included in the executable OpenAPI.

Validated runnable examples are generated into `contracts/examples/` by the smoke script; they are outputs of the retained fixtures, not a second synthetic dataset. The generated report/result match the executable schemas. `expected-controls.json` is independent of server calculation.

## Handoff module contract (reserved, not implemented endpoints)

Acquisition lane delivers a versioned `AcquiredFile` evidence record: `runId`, `sourceId`, `reportType`, `startDate`, `endDate`, `timezone`, `synthetic`, `acquisitionVersion`, `filename`, `checksum`, `byteSize`, `downloadedAt`, `artifactPath`. `artifactPath` is a private verified artifact/object reference; never an arbitrary client-chosen filesystem path or a signed secret URL in logs. Dates/currency/grain match the reporting contract. File identity is SHA-256 of exact bytes, not browser text or filename.

Run states are `queued → running → downloaded → verified`, or `failed`/`cancelled`. Successful download is not successful publication. Failed/cancelled runs have a typed failure code and last completed step; they never fabricate an acquired file. Initial replay is local deterministic browser work; no AI/model provider prerequisite.

Data lane consumes verified `AcquiredFile` plus exact bytes through a lead-approved intake adapter. A batch is `received → validated → reconciled → published`, or `quarantined`/`failed`; publication records link `runId → raw artifact → batch → source row → normalized record → metric version`. Accepted + rejected rows account for input rows; blocking exceptions prevent publication. Corrections propose a superseded batch/version and retain prior history; they do not overwrite raw files. Last-good result remains queryable with an explicit stale/coverage warning.

Application lane consumes generated API outputs, never recalculates an independent financial truth. Until richer shared APIs are approved it can build views from the existing result/source shapes and schema-valid examples; it must not invent routes or hide failed requests behind fixture data. Role-specific views are informational in the synthetic MVP; actual sign-in/role enforcement is a separate accepted scope decision.

These module contracts freeze semantics for independent implementation; richer run/batch APIs must be proposed to the lead for a coordinated OpenAPI revision **before** clients use them.

## Ownership and issue mapping

| Local delivery | Existing GitHub requirement references | Boundary |
|---|---|---|
| Shared foundation | GOV-01–04 (issues 13/11/15/9), ENG-01–02 (33/37), DAT-01 (25) | Evidence, scope, contracts, fixture validation, supervised thin path. Not a claim that all issue work is complete. |
| Acquisition | ING-01–05 (14/16/17/10/12) | Replica, replay, actual-file verification, bounded failures. ING-06 Jev and ING-07 recorder remain optional/deferred. |
| Trusted data | DAT-02–06, DAT-08 (22/27/19/26/23/20) | Archive, normalize, deduplicate/overlap/corrections, reconcile, metrics and coverage. DAT-07 inventory and DAT-09 larger DAG are gated follow-ons. |
| Reporting views | APP-01–03 (38/32/34) | Operations/leadership/finance evidence. Export subset P1; APP-04–07 tools/assistant/evaluation/production Microsoft remain deferred. |
| Integrated verification | ENG-04–05 and REL-01 (42/44/43) | Independent totals, controlled integration, reproducible demo, truthful backup evidence. Full overnight-runner configuration ENG-03 (30) requires verified launch gates. |

Lead: OpenAPI, generated types, manifests/lockfiles, artifact registration, global API/frontend routes, shared foundation shell, status and integration. Data owner alone: new data schema/migrations; foundation's one publication table is handed over, not concurrently edited. Three implementation owners submit interface changes instead of editing each other's files. Independent reviewer prepares expected results without editing financial implementation. Per-lane packets: `handoffs/`.

## Open gates — do not call this unattended-ready

- Lead acceptance of this scope/metric/API baseline is required before releasing downstream lanes.
- Resolve the user's incomplete-data-coverage correction: confirm whether the remaining valid supplied datasets are part of P0 or explicitly deferred. See the per-file audit in BUILD_SUMMARY.md; do not confuse source-status labels with working adapters.
- The selected workflow is GitHub-first supervised branches/PRs. The merged five-person guide proposes allocations, but human confirmation, accepted scaffold integration and existing acquisition contribution review remain open. Its later dated GitHub verification supersedes this document's initial repository observation where they differ.
- Authorized GitHub review found four collaborators with write access; that does not prove local clone readiness or named lane acceptance. The user confirmed Pro and four teammates' Core subscriptions. Runner slots, workspace payer and spending controls have **not** been verified. Separate memberships do not establish a pooled budget.
- No overnight/task-runner dispatch, review/apply/cancellation exercise, scheduler or timeout/spend enforcement has been tested here. The mandatory frontend helper was a bounded local build helper, not proof of the native isolated task runner.
- Confirm current event deadline, lane deadlines, per-task and total spend caps and named human reviewers. Suggested 60-minute checkpoint/two failed repairs are planning limits, not automatically enforced by this app.
- Three implementation tasks remain blocked on foundation acceptance; integrated verification depends on all three reviewed outputs. Do not launch siblings, merge unattended, publish externally or access live marketplaces from this checkpoint.

The lead must verify the chosen runner's review/apply and cancellation behavior before any unattended run. If available controls cannot enforce a cap, use supervised runs and describe that limitation rather than pretending the runner is bounded. Native Replit runner verification does not block the selected supervised GitHub-first workflow.