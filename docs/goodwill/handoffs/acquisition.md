# Immutable acquisition lane packet — foundation 1.0.0

> Historical packet. Use ../SCOPE.md, ../CONTRACT_V2.md and ../PARALLEL_BUILD.md
> for the current target, contract and permitted edit paths. They supersede
> the release status and ownership below.

Release status: **blocked until lead accepts foundation and launch gates are verified**. This packet does not authorize a job launch.

Requirement references: ING-01–05; source authority, screenshots and discrepancies are in `../FOUNDATION.md`. Goal: replace supervised manual generation with one verified real-file deterministic browser flow against a local synthetic replica, not a live integration.

## Baseline and permitted ownership

- Accepted technical baseline is the current Goodwill app/API and OpenAPI 1.0.0; lead acceptance is still pending.
- Preserve `docs/goodwill/evidence/github/goodwill/synthetic-data/` unchanged. Upright SHA-256 and independent controls are in `../contracts/examples/expected-controls.json`.
- Own new `artifacts/goodwill/src/replica/`, `artifacts/api-server/src/acquisition/`, replica assets scoped inside that directory and acquisition/browser tests scoped under `artifacts/api-server/tests/acquisition/`.
- Lead integrates the replica route and mounts new backend routes; do not edit `App.tsx`, global CSS, app/router entrypoints, manifests/lockfiles, OpenAPI/generated clients, data modules or DB/migrations.
- Read the 17-slide PowerPoint images in `attached_assets/goodwill-reference/`. Separate Drive screenshot folder remains individually unreviewed. Do not recreate personal email/account values from screenshots.

## Frozen input/output

Parameters: source `upright`, report `paid_order_items`, start/end dates inside August 2026, Eastern reporting timezone, synthetic true. Return the verified exact CSV artifact and `AcquiredFile` fields/states specified in FOUNDATION, plus browser step evidence and checksum. Never pass a screenshot or generated metadata as proof that a file was actually downloaded.

The replica should call the existing `POST /api/goodwill/report` to create genuine filtered fixture bytes. Supply stable DOM labels for replay. Synthetic item-grain adaptation must remain labeled; actual live Paid Order Report schema/timezone is unverified.

Propose a shared run/intake API change to the lead if necessary; do not invent a separate persistence store or runtime route contract. Raw artifact archival is owned by the data lane; acquisition produces download evidence and hands off bytes.

## Acceptance

1. Real DOM process with Reports/Paid orders-or-labeled-item-demo, date range, generate confirmation, readiness and downloadable file.
2. Browser selects inputs instead of hard-coded dates. First/second periods download different verified contents and SHA-256 values.
3. Delayed generation, failed download, expired session and DOM drift stop visibly; bounded retry never reuses an unrelated old file.
4. Trace downloaded bytes into the approved intake boundary. Manual fallback remains available and labeled; no hidden fixture fallback when replay fails.
5. No real marketplace credentials, Copilot/Jev provider requirement, external email delivery or provider restriction bypass.

Commands: full `pnpm run typecheck`; own browser tests; `python scripts/goodwill-foundation-smoke.py` after lead integration. Add packages only by proposing changes to the lead.

Limits: suggested 60-minute checkpoint, at most two failed repairs; actual task deadline and spending cap **unconfirmed**. Stop rather than work unattended without verified limits. Cross-lane dependency/interface change: return a blocker/proposal to the lead.

Return `docs/goodwill/reports/acquisition.md`: changed-file list, tests actually executed and results, downloadable artifact/evidence paths, measured runtime, known limitations, interface requests and blockers. Do not modify shared status. Human review/apply only.