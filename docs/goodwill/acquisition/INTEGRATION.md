# Acquisition lane handoff

## Delivered scope

Synthetic Upright acquisition modules are implemented and tested; the complete
Goodwill repository is **not** finished. This lane does not mount shared routes,
change the application shell, install dependencies, apply migrations, implement
the data parser or claim live compatibility. Existing downstream data/reporting/
independent-verification tasks cover those remaining steps.

### Exact paths

- `artifacts/api-server/src/goodwill/acquisition/{contracts,verify,postgres,service,browser,router,index}.ts`
- `artifacts/goodwill/src/features/acquisition/{ReplicaPortal,AcquisitionConsole,index,inspection}.tsx`
  (`index` is `.ts`; `inspection.html` is the development-only inspection entry)
- `artifacts/api-server/tests/acquisition/{helpers,core.test,postgres.test,browser.test}.ts`
  and `run.mjs`
- `docs/goodwill/acquisition/{INTEGRATION,SCHEMA_PROPOSAL,PROCESS_MAPPING}.md`,
  `control-downloads.py`, `evidence/browser-checks.json`, and two actual browser CSVs

No upstream fixtures, legacy reporting modules, global routes/styles, shared
contracts/generated outputs, packages, lockfiles or shared database schema were
edited.

## Lead/data integration requests

1. Review the data-owned run-table proposal in `SCHEMA_PROPOSAL.md`. Implement/
   apply it only after migration review; no automatic schema push.
2. Lead installs/pins a runtime Playwright dependency and provisions Chromium
   through approved package management. Inject its `chromium` launcher; the
   acquisition implementation never imports an undocumented platform package.
3. Implement the common data-owned private immutable archive interface:
   `put(runId, Uint8Array, {filename, checksum}) -> RawArtifact`;
   `read(opaqueArtifactId) -> Uint8Array`. Verify size/hash on reads and retain the
   original bytes. No raw-file database storage or runtime in-memory fallback.
   Opaque IDs here must use `[A-Za-z0-9_-]`, 1..160 characters; adapt storage paths
   behind the opaque reference, not in public run metadata.
4. Construct `PostgresRunRepository` with a parameterized SQL client and
   `BrowserReplay` with **one server-configured approved replica origin/path**.
   Browser subrequests/navigations are constrained to that origin; no user URL,
   username, password, query or hash is accepted. `testFault` is test-only and
   must not be set by production request bodies.
5. Construct `AcquisitionService`, await `initialize()` before accepting requests,
   then mount `createAcquisitionRouter(service)` at `/api/goodwill/v2`. Restrict
   these routes to the app's authorized operators using the existing auth policy.
   Run a single supervised worker; do not call initialize while its predecessor
   or active runs are still executing.
6. Lead registers `ReplicaPortal` and `AcquisitionConsole` in the existing shell,
   retaining the artifact base path. Default portal transport posts the unchanged
   legacy generation request to artifact-relative `/api/goodwill/report`.
   Inspection HTML is a development check, not a production route.
7. Wire `resolveVerifiedRun(runId)` into the common intake service. It rereads/
   checks archived bytes and returns verified run metadata, raw bytes transiently,
   and frozen provenance. Convert `Uint8Array` with `Buffer.from()` only at a
   Buffer-typed service boundary. Intake must verify source/report/period against
   the request, retain run/artifact/checksum lineage and call the **same parser**
   used by manual upload. Never publish solely because acquisition verified.
8. Manual API must implement the frozen upload-ticket → PUT → batch contract.
   Signed PUTs must allow `Content-Type: application/octet-stream`. Configure
   storage CORS for the approved app origin/method/header. Tickets are ephemeral
   and not logged; the frontend hashes/sends exact bytes, limits to 5 MiB and
   explicitly rejects XLSX/PDF/non-CSV without source sniffing.
9. Add `node artifacts/api-server/tests/acquisition/run.mjs` to lead-owned
   validation/CI. Existing shared test runner discovers only top-level tests.
   Run integrated private-storage/restart/auth checks and downstream full QA.

```ts
// Illustrative lead wiring only: not an applied shared-route patch.
const repository = new PostgresRunRepository(pool);
const replay = new BrowserReplay({
  launcher: chromium,
  replicaUrl: approvedReplicaUrl,
  allowedOrigin: new URL(approvedReplicaUrl).origin,
});
const service = new AcquisitionService({
  repository, archive: dataOwnedPrivateArchive, replay, fixture: unchangedUprightCsv,
});
await service.initialize();
app.use("/api/goodwill/v2", operatorAuth, createAcquisitionRouter(service));
// Data batches: inputKind=run -> service.resolveVerifiedRun(inputId) -> common intake.
```

## HTTP/behavioral boundaries

- POST `/runs`: frozen Upright/paid_order_items request, August 2026 inclusive
  dates, scenario success/delayed/session_expired/dom_drift/missing_report.
  Unknown root/period fields reject. Returns 202 queued; no auto-publication.
- GET `/runs`: persistent history; offset >=0, integer limit 1..500.
- GET `/runs/:runId`: original request, attempt, timestamps, last step, failure/
  next action and artifact provenance. No financial success metrics.
- POST `/runs/:runId/cancel`: idempotent; terminal runs stay terminal.
- GET `/runs/:runId/download`: verified archived bytes only;
  `application/octet-stream` (frozen binary client contract), attachment filename,
  `X-Content-SHA256`, byte length, `Cache-Control: no-store`.
- Outer acquisition timeout <=60 seconds, inner report wait <=55 seconds; four
  active runs maximum per single worker. One explicit retry, two attempts total;
  same identity and period, unique retry reservation. No auto-retry/scheduler.
- Failures expose safe code/message/next action, not upstream HTML, cookies,
  filesystem paths or credentials. Browser unavailability is a failure, not
  direct HTTP fixture delivery dressed up as automation.

## Reproducible verification

From workspace root, with approved DB configured and Playwright/Chromium installed:

```sh
node artifacts/api-server/tests/acquisition/run.mjs --unit
node artifacts/api-server/tests/acquisition/run.mjs
python docs/goodwill/acquisition/control-downloads.py
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/goodwill run typecheck
```

This workspace's explicit **test-only** executable/module overrides:

```sh
GOODWILL_PLAYWRIGHT_MODULE=/mnt/pid2/node_modules/playwright/index.mjs \
GOODWILL_CHROMIUM=/repl/tools/bin/chromium \
GOODWILL_LAST_GOOD_CHECK_URL=http://127.0.0.1:80/api/goodwill/latest \
node artifacts/api-server/tests/acquisition/run.mjs
```

These paths are environment-specific test conveniences, not runtime dependencies
or production configuration. Missing Playwright is an explicit test failure.
The optional last-good URL is used only to compare an unchanged live development
response before/after the harness; it is not a production URL or browser replay.

### Verified results

- 12 named tests passed: real browser scenarios/operator controls; byte/period/
  header/hash checks; run lifecycle; invalid parameters; cancellation; bounded
  timeout; concurrent one-retry reservation; interruption; archive integrity;
  actionable failure evidence; real PostgreSQL repository.
- Actual downloaded August 1–7 CSV: **141 items, 22,464 bytes**,
  SHA256 `f13d40cf2b281296d965a4aaa1c96d65740a6571b5e0ee448730db9e21c87436`.
- Actual downloaded August 8–14 CSV: **129 items, 20,454 bytes**,
  SHA256 `903b5693b4d2a37fbd2ea5299800796bd21881304cdd4c9fa673b84e4be817b6`.
- DOM drift, session expiry, missing report, wrong dates and failed download
  failed explicitly; delayed generation succeeded. Cancelled runs had no artifact.
- Operator binary download matched verified checksum; reload retained run history.
  Manual upload sent the original bytes; both intake request shapes passed.
- Unsupported filter/format rejected. Console emitted no uncaught browser errors.
- Real PostgreSQL test used only a rolled-back connection-local temporary table.
- Existing development last-good response was identical before/after all browser
  scenarios. Acquisition never imports the financial publication writer.
- Backend/frontend typechecks passed. Evidence JSON contains measured elapsed
  time and expected/actual controls; no estimated partner efficiency claims.
- Existing 13 foundation API tests also passed. Frontend production build requires
  the managed service's nonsecret build parameters, e.g.
  `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/goodwill run build`.
- Styled replica desktop/mobile layouts were inspected through the managed preview;
  images are saved in `evidence/replica-desktop.jpg` and `replica-mobile.jpg`.
  These are development inspection entries, not authenticated production pages.

## Explicit limitations/review gates

Browser harness uses test-only repository/archive doubles; PostgreSQL is tested
separately. Common intake endpoints in this lane's browser test are **transport
spies**, not data-lane parsers or financial acceptance. Real App Storage, applied
run schema, full process restart, authorization and shared routing need reviewed
integration. Failed imports/overlap/corrections and all-source metrics belong to
downstream data/QA. Live source fidelity and human reviewer approval remain
unverified. Nothing was published, emailed, merged upstream or submitted.