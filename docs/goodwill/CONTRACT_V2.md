# Contract 2.0.0 — implementation invariants

Authority: `lib/api-spec/openapi.yaml`, generated clients in `lib/api-client-react`
and validators in `lib/api-zod`. Legacy endpoints retain contract 1.0.0 unchanged.
New endpoints are reserved, not claimed live at this foundation checkpoint.

## Exact bytes and common intake

Manual upload: request ticket with filename/source/report/byte size/SHA256 →
PUT the **original bytes** directly to private object storage → create batch
using the server-issued upload ID. Acquired: browser download → checksum/header/
period verification → immutable object storage → create batch using verified run
ID. Both resolve into the same intake service. Store bytes in object storage and
queryable metadata in PostgreSQL; never embed a raw CSV/base64 body in v2 DB rows.

No client filesystem paths, arbitrary URLs, source sniffing or silent fallback
to a bundled fixture. Allowlisted source/report identities must match receipt.
Recompute size/hash after reading the object, before parsing. A caller checksum
is not trusted evidence. Upload tickets are single-purpose, expire, have bounded
size (5 MiB) and are tied to a server-owned object reference. Presigned URLs are
transient capabilities: do not log them, put them in examples or store them in
provenance. Explicitly mark all supported data synthetic.

Download attachment headers include filename and X-Content-SHA256. Each batch
retains artifact ID, exact-byte checksum, period, source/report, contract version,
acquisition run (nullable for manual upload), timestamps and counts.
Row references are one-based CSV **data record** ordinals excluding header,
not physical text line numbers; quoted newlines do not change the record ordinal.

## Lifecycle, idempotency and corrections

Runs: queued → running → downloaded → verified, or failed/cancelled.
Verified acquisition does not imply accepted/reconciled/published financial data.
Bound browser waits to 60 seconds; one explicit retry (maximum two attempts).
Only allow known replica destinations, never a caller-selected browser URL.
Cancel is idempotent; terminal runs cannot resume or deliver twice. Retry creates
a new linked run. Restarted unfinished runs must be marked interrupted/failed.

Batch: received → validated → reconciled → published/partial. Invalid header or
blocking mismatch/conflicting record → quarantined; infrastructure error → failed.
Partial means accepted valid rows were published and rejected rows are disclosed.
Every attempt stays visible. At parsed-row stage:
`inputRows = acceptedRows + rejectedRows + duplicateRows`.
Unknown store is retained as `__unknown__`, not rejected; missing buyers are
retained with incompleteness, not invented. File-level parse failure can have
zero counts with a file-level reason; do not pretend all rows were inspected.

Identity: source + report grain's stable key, never checksum alone. Same file
checksum within the same source/report is a duplicate attempt referencing the
original batch. Same key/same normalized values across overlapping files is a
duplicate row. Same key/different values quarantines the conflicting batch:
never last-writer-wins. Database uniqueness and transactions protect concurrent
requests. Do not infer cross-source sameness.

Correction review requires the current immutable publication ID, explicit
confirmation, reason, and reviewer action. Approve supersession only for an
identified corrected dataset/scope; retain prior raw artifacts, row history and
old immutable publication. Reject leaves metrics unchanged. A changed current
publication returns 409. A failed import cannot erase last-good data. UI exposes
failed latest attempt and stale last-good state separately.

## Metrics and evidence

All monetary fields are integer cents within JavaScript safe integer range.
Parse decimal strings without floating multiplication and reject malformed,
overprecision or out-of-range amounts. Every source field is a line total;
never multiply by quantity. `net_item_sales` excludes shipping, tax and fees.
`source_net` preserves the source's named net/payout formula, NOT net item sales.
`shipping_expense` uses postage plus signed adjustments for OSM/PB/EasyPost
and charges minus refunds for FedEx; it is not revenue or margin.

One `sourceId` per metric query. No implicit all-sources total or cross-platform
unique buyers. Use America/New_York calendar dates; naive source dates are
already local. Date intervals are inclusive. Validate real calendar dates and
start <= end in server logic as well as structural schemas.

Customers: distinct nonempty buyer IDs per platform/day, with missing-buyer
counts. A multi-day query's aggregate is null; its daily points remain valid.
Per-store distinct customers are not additive across stores. Use matching sales
activity, not Amazon posted dates or books payment dates.
Listings: only distinct new-listing events, not sale rows or relists.
Backlog: exactly one explicitly selected complete declared-universe snapshot;
not the sum of snapshots, nor inferred from sales. Missing/partial snapshots
return null or clearly labelled partial counts, never a confirmed full backlog.

Metric query response carries definition/version, exact query, publication ID,
coverage, warnings and batch IDs. Evidence and export requests pin that publication
ID so later imports cannot alter a displayed figure's drilldown. For sums, all
contributing rows reconcile exactly; distinct-count evidence explains dedup keys.
Pagination does not change full result totals. Financial discrepancies block
publication rather than being rounded away.

Null means unavailable; zero requires valid complete source coverage. Coverage
distinguishes report period, last successful acquisition/publication, latest
attempt and missing dimensions/buyers/snapshot scope. An empty report does not
prove all stores or all dates have complete coverage.

Export kind summary/evidence requires query + publicationId; rejections requires
batchId. Reject invalid combinations. CSV uses UTF-8, escaped quoted fields and
spreadsheet formula-injection protection for text starting `= + - @`, tab/CR.
Machine numeric amounts must be strictly validated before formatting. Include
synthetic/source/period/definition/coverage labels; never unsupported KPIs.

## Server and lane interface

Data lane exports a Router mounted by the lead at `/api/goodwill/v2` and an
intake service accepting a resolved server-owned artifact. Acquisition lane
exports its separate Router for `/runs`, not a competing batch parser.
Use dependency injection between lanes:

```ts
interface VerifiedAcquisition {
  runId: string;
  sourceId: "upright";
  reportType: "paid_order_items";
  startDate: string;
  endDate: string;
  filename: string;
  bytes: Buffer; // transient service boundary only, not DB or public JSON
  checksum: string;
}
// Acquisition receives archiveVerified(input) -> RawArtifact from data lane.
// Data intake receives resolveVerifiedRun(runId) -> server-owned metadata.
// Lead wires these dependencies; each lane tests with injected test doubles.
```

Run persistence needs data-owned tables; acquisition proposes its fields using
the Run schema, data owner supplies repository methods. Until wired, neither
lane may claim persistence works using an in-memory fallback.

Shared contract changes, schema generation, dependencies and final routing are
lead-owned. Structural examples are explicitly labelled test fixtures, never
API fallbacks. Generated schemas do not replace the semantic invariants above.