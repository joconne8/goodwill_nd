# Data lane handoff — contract 2.0.0

## Delivered, and not claimed

The injectable backend data lane implements the nine original business formats,
all six supporting files, and explicit opt-in replay/invalid/September fixtures.
All 27,544 base records were parsed and checked against unchanged original bytes.
This is **not** completion of the whole repository or an assertion that v2 is live.
Reporting screens, shared registration, provisioning and human review are separate.

Runtime has no bundled-file or in-memory fallback. Test doubles are confined to
`artifacts/api-server/tests/data`. No live vendor format, production accounting
mapping, unattended automation, partner approval or customer attribution is claimed.

### Exact changed areas

- `artifacts/api-server/src/goodwill/data/`
  - `catalog.ts`: fifteen explicit source/report/grain/header/amount definitions.
  - `normalize.ts`: strict UTF-8/CSV, actual calendar/offset validation, Eastern
    activity dates, exact integer cents, source formulas and signed expenses.
  - `types.ts`: typed metadata/normalized ledger/service boundaries.
  - `archive.ts`: immutable private GCS adapter, pinned-generation reads, SHA256,
    create-only writes and the standard sidecar PUT-signing protocol.
  - `postgres.ts`: parameterized persistent documents, transaction rollback,
    append-only evidence/publications/audits and cross-process advisory locking.
  - `intake.ts`: common run/upload path, histories, dedup, reconciliation,
    last-good publication, synthetic correction review and interruption recovery.
  - `reporting.ts`, `wire.ts`, `export.ts`: source-local catalog/metrics, string-map
    wire evidence, pinned revisions, safe paginated drilldown and CSV.
  - `router.ts`, `seed.ts`, `index.ts`: injectable authenticated Router and explicit
    supervised seed, never an automatic import.
- `artifacts/api-server/tests/data/{helpers.ts,core.test.ts,publication-safety.test.ts,postgres.test.ts,run.mjs}`
- `lib/db/src/schema/goodwill-v2.ts`
- `lib/db/migrations/goodwill-v2-review-required.sql`
- `docs/goodwill/data/{INTEGRATION.md,independent-controls.py,evidence/controls.json}`

No fixtures, acquisition modules, shared route registration, schema barrel,
OpenAPI/generated files, root dependencies/lockfiles, app shell or reporting
screens were edited. No upstream push, merge, deployment or accounting action.

## Lead wiring (review required)

1. Review/apply the SQL migration **as its own transaction** only after checking
   current tables. It creates nine tables: acquisition runs and eight data
   metadata collections. There are no drops, renames or legacy-data rewrites.
   It fails rather than silently adopting an existing incompatible table.
   Review JSONB/index/publication-reference growth and retention costs.
2. Lead registers the matching Drizzle definitions in the shared schema barrel.
   Do not use `push-force`; the migration is deliberately not applied by runtime.
3. Provision private App Storage and its approved browser PUT CORS. Platform setup
   was attempted twice and returned an internal setup-service error both times.
   **Live private-object retention, real signed PUT and storage CORS remain
   unverified.** No fake object directory or substitute runtime archive was used.
4. Lead adds/pins the GCS SDK dependencies required by the official storage
   template, and constructs its unchanged sidecar-authenticated client. Inject
   that client (or a small typed facade) into `PrivateArchive` with the approved
   `PRIVATE_OBJECT_DIR` and exported `signPrivateUpload`. Do not expose immutable
   keys as public assets or give browser PUT capabilities for immutable paths.
   Run/upload archive writes use opaque IDs; size, generation and SHA256 are
   rechecked before financial acceptance.
5. Create `PostgresRepository(pool)`, load the reviewed fixture control metadata
   explicitly with `loadApprovedControls(serverConfiguredRoot)`, and create the
   intake/reporting services. This loads **control metadata only**, not reports.
6. Wire acquisition's `resolveVerifiedRun` directly into intake; the existing
   return shape is structurally compatible. Inject this same private archive
   into acquisition. The original browser CSV is never regenerated for intake.
7. Stop the predecessor before calling `intake.initialize()` and acquisition's
   initializer. Interrupted attempts are marked failed, not published. Recovery
   is supervised, single-worker startup; do not interrupt a live predecessor.
8. Mount `createDataRouter(intake, reporting, authorizeOperator)` at
   `/api/goodwill/v2`, alongside the separate acquisition Router. The required
   authorization callback returns the server-known operator ID or null. There is
   no permissive default. Use existing app authorization, not a test header.
9. Add the data runner to the lead-owned validation/CI entry point. The current
   top-level test runner does not discover this nested directory.

Illustrative wiring, **not an applied shared patch**:

```ts
const archive = new PrivateArchive(approvedSidecarGcsClient, privateObjectDir, signPrivateUpload);
const repository = new PostgresRepository(pool);
const controls = await loadApprovedControls(serverConfiguredFixtureRoot);
const intake = new IntakeService({
  repository, archive, controls,
  resolveVerifiedRun: id => acquisitionService.resolveVerifiedRun(id),
});
const reporting = new ReportingService(repository, controls);
await intake.initialize(); // predecessor already stopped
app.use("/api/goodwill/v2", createDataRouter(intake, reporting, authorizeOperator));
```

## API behavior

- `GET /catalog` reads actual published stores/coverage; no invented 24-store list.
- `POST /uploads` validates a CSV basename, explicit source/report, original size
  and SHA256; creates an owner-bound ten-minute ticket and transient signed PUT.
  Upload bytes using `application/octet-stream`, then `POST /batches`.
- `POST /batches` accepts only opaque upload/run IDs and validated periods.
  Resolved receipt scope/hash/size is checked, sealed evidence is reread, and
  both input kinds invoke the same parser. Every valid intake request gets a
  persistent attempt even if receipt resolution or infrastructure fails.
- GET batch/history/row pages disclose file-level failures, counts, rejected
  ordinals and duplicates. CSV data-record ordinals exclude header, including
  multiline quoted cells. File replay has zero row counts because no records
  were reinspected; it references the original attempt.
- Identical record values across files do not add revenue. Conflicting keys
  quarantine the entire attempt, including otherwise valid new rows.
- Recoverable malformed rows may publish a disclosed partial batch. Wrong
  financial period, source-formula or independent-control mismatch blocks the
  batch. Both source-field and derived-metric overflow are checked before
  publication/supersession, not just per cell. Positive and negative subtotals
  are bounded independently so cancellation cannot hide an unsafe filtered
  day/store/category total.
- Review requires current global publication ID, explicit synthetic-only
  confirmation, reason and reviewer identity. Only the exact period/key set of
  one identified original batch can be superseded; malformed/ambiguous scope
  cannot be approved. Reject and stale-publication review leave metrics intact.
  Old bytes, immutable records and publication snapshots remain queryable; the
  immutable review audit retains pre-review counts/failure and staging dispositions.
- Metrics accept one business source and at most a 366-day window. Books is
  statement-month activity; Amazon is posted activity; shipping is expense.
  Only sources with buyer IDs and daily activity support customers. Multi-day
  customer aggregate is null; store/category counts are not additive.
- Listings use the supplied distinct platform/listing events. Backlog requires
  one selected snapshot plus the complete approved catalog universe and matching
  independent snapshot count/control; unknown/partial snapshots are null.
- Missing attribution is Unknown, not inferred from matching-looking order IDs.
  Optional store-reference coverage and supporting batch IDs are reported without
  dropping valid financial rows merely because the dimension is missing.
  Snapshot categories are explicitly joined from its required catalog; snapshot
  store attribution is not repaired. Quality/lifecycle sidecars remain separate
  synthetic curated datasets, accessible through their batches/rows. They do not
  rewrite source sales/buyer/refund facts or create unsupported metrics.
- Missing coverage is null, not zero. Failed latest attempt is disclosed separately
  from last-good values. A caller-declared interval alone does not prove coverage.
  Full original hashes/control checks establish complete supplied-base coverage;
  verified acquisition establishes its bounded interval only when no rows are
  rejected. Partial runs do not certify missing-day zeros; independently complete
  accepted inputs may still provide retained coverage. Unrecognized manual/
  incremental formats with valid rows publish observed partial coverage, not an
  invented complete close.
- `/evidence/query` and summary/evidence `/exports` pin an immutable publication.
  Pagination preserves full totals. Wire `values` are strings, including integer
  cents, with structured reasons; normalized financial evidence labels cents.
  Malformed staging evidence is labelled original unvalidated source cells.
  Signed URLs and file bytes never enter database documents or provenance.
- Exports are the frozen JSON `CsvExport` response, not a new Blob endpoint.
  They carry checksum, source/period/definition/coverage/synthetic labels, quote
  fields, guard spreadsheet formulas and validate numeric machine cells.

## Explicit seed

`seedFixturePack(intake, trustedServerRoot, {confirmSyntheticOnly:true,owner})`
checks all base byte hashes and uses the same ticket/PUT/intake path. Its default
is exactly fifteen base inputs. `includeIncremental` and `includeTestFixtures`
must be explicitly enabled for the other four files. Never expose a client
filesystem-root selector, run the generator over originals or seed on startup.

## Measured verification

```sh
pnpm --filter @workspace/api-server run typecheck
pnpm exec tsc --noEmit -p lib/db/tsconfig.json
node artifacts/api-server/tests/data/run.mjs
python docs/goodwill/data/independent-controls.py
```

Fifteen named data tests pass, covering all fifteen base inputs and four opt-in
files, full source/daily/listing/snapshot controls, common run/manual path,
byte identity, original-file replay, overlapping keys, invalid/partial rows,
blocking reconciliation, integer overflow, correction approval/rejection,
publication concurrency, frozen evidence/export schemas, owner/expiry/scope,
authentication, generation-pinned archive behavior and real PostgreSQL metadata.
Targeted publication-safety regressions cover derived shipping overflow despite
safe individual field totals, signed cancellation hiding unsafe daily subtotals,
rollback of an unsafe reviewed replacement, rejected verified-run monetary rows
without fabricated zeros, and retained independent complete accepted coverage.

Python independently reads the unchanged CSV with Decimal, CSV and timezone
libraries, without importing application arithmetic. Expected and actual cents:

| Metric | Source | Expected | Actual |
|---|---|---:|---:|
| Net items | CashMonkey | 1,032,846 | 1,032,846 |
| Net items | Upright | 3,615,710 | 3,615,710 |
| Net items | ShopGoodwill | 11,126,218 | 11,126,218 |
| Net items, statement month | Books | 918,493 | 918,493 |
| Net items | eBay | 5,551,526 | 5,551,526 |
| Posted item activity | Amazon | 1,306,005 | 1,306,005 |
| Source net | Jewelry | 1,799,730 | 1,799,730 |
| Expense | OSM/PB/EasyPost | 3,281,419 | 3,281,419 |
| Expense | FedEx | 2,012,104 | 2,012,104 |

These are **separate controls, not a revenue sum**. Every other source-named
net/payout total and daily/customer/listing control also matched. Three snapshots
were separately proven at 2,577/2,196/1,246 inventory and 832/757/765 unlisted,
then queried by one platform at a time. Evidence sums match displayed sums.

The ten upstream `test_data.py` tests passed against a disposable **copied**
pack under `/tmp`, so its generator/reproducibility test never touched originals.
API/db typechecks passed. Results are in `evidence/controls.json`.

### Important test limits

Full-pack and HTTP tests use explicitly test-only archive/repository doubles.
The production GCS adapter is exercised with an SDK double, not claimed to have
written a cloud object. PostgreSQL tests use connection-local TEMP tables only:
they verify real SQL, a second repository adapter, rollback, immutable JSONB,
interruption recovery and a separate-connection advisory-lock exclusion, without
applying the migration or touching legacy data. They do not prove full process
restart or distributed worker deployment against approved permanent tables.

Live storage PUT/CORS/retention, applied-schema restart, existing-auth integration,
shared routes, reporting UI and independent final regression remain reviewed
integration/release gates. Existing downstream reporting and verification tasks
cover those next steps; no duplicate follow-up was added.