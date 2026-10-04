# Immutable trusted-data lane packet — foundation 1.0.0

> Historical packet. Use ../SCOPE.md, ../SOURCE_SEMANTICS.md, ../CONTRACT_V2.md
> and ../PARALLEL_BUILD.md. All 15 base files and opt-in fixtures now have
> required dispositions; do not treat this earlier single-source packet as scope.

Release status: **blocked until lead accepts foundation and launch gates are verified**. Requirement references DAT-02–06 and DAT-08. Goal: deepen the thin foundation into a trustworthy staged import/publication path. Do not regenerate the already merged synthetic dataset.

## Ownership

Own new `artifacts/api-server/src/ingestion/`, `artifacts/api-server/src/reporting/`, new data schema files in `lib/db/src/schema/` and scoped tests under `artifacts/api-server/tests/data/`. This lane alone owns development migrations. The foundation publication schema is handed over for a reviewed extension; do not drop its current normalized data.

Lead owns schema barrel edits if another worker needs them, public route mounts, manifests/lockfiles, OpenAPI/generated files and status. Propose adaptations to `src/lib/goodwill.ts`/`src/routes/goodwill.ts` instead of silently replacing the supervised path. No frontend/replica edits or production DB actions.

Read `../FOUNDATION.md`, OpenAPI and schema-valid `../contracts/examples/`. Preserve the entire source fixture pack and generator unchanged. Independently verify expected controls instead of using implementation output as its own oracle.

## Frozen semantic contract

Consume verified `AcquiredFile` and exact bytes, not an arbitrary client path. Archive bytes immutably in App Storage; PostgreSQL stores only object paths and queryable metadata/normalized rows. Read the object-storage implementation instructions before designing this boundary.

Raw → staging → curated → metric publication. Grain: order/item row; declared source keys; exact source-row lineage. USD integer cents, Eastern reporting period, gross minus item refunds. Source shipping/tax/fee/payout fields remain separate. Missing customer/labor/inventory data is unavailable, never zero or estimated.

Return batch/publication/exception records with the states and linkage defined in FOUNDATION. Existing `ReportingResult` totals/rows/identity remain compatible until the lead approves a coordinated version change. A dashboard value must be explainable by its exact file and normalized rows.

## Acceptance

1. Source file integrity/header/period/grain validation; raw retention and batch/row lineage.
2. Reconciliation of file row counts and monetary totals to curated/publication controls. Rejects are explicit and accounted for.
3. File replay, record replay and overlapping report ranges do not inflate published metrics.
4. Different/corrected source bytes enter a reviewed supersession workflow retaining previous raw/batch/history; no silent overwrite.
5. Blocking failures/quarantine leave last-good publication unchanged and show stale/coverage warnings.
6. Exact full-August controls: 650 rows, gross 3,702,126 cents, refunds 86,416, demo net 3,615,710. Eight missing buyer IDs.
7. First/second-week alternate scopes match independent controls. Do not combine Upright/channel/settlement sources into an unreviewed revenue total.

Commands: `pnpm run typecheck`; scoped tests; `python -m unittest test_data.py` from retained fixture directory; `python scripts/goodwill-foundation-smoke.py` after integration. Propose package/API changes before use; do not weaken tests to pass.

Limits: 60-minute suggested checkpoint and at most two failed repairs, not enforced by this app. Actual deadline/caps and owners unconfirmed: no unattended start. Stop on financial-definition changes, missing approved storage/access, cross-lane writes or failed limits.

Return `docs/goodwill/reports/trusted-data.md`: changed files/migration plan, tests actually run, independent expected-results comparisons, reconciliation and failure evidence, measured runtime, limitations, proposed interfaces and blockers. Human reviewer approves financial rules and application order.