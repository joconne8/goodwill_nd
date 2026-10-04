# Parallel implementation reservations

Baseline: current goodwill_nd foundation PR, after lead technical checks.
Three implementation lanes may then run concurrently. They share a contract,
not partially implemented modules. Existing queued project tasks remain the
same tasks; do not create duplicates or imply a packet launches a worker.

| Driver | Permitted new/edit area | Separate reviewer |
|---|---|---|
| Acquisition agent | `artifacts/api-server/src/goodwill/acquisition/**`, `artifacts/goodwill/src/features/acquisition/**`, `artifacts/api-server/tests/acquisition/**`, `docs/goodwill/acquisition/**` | lead; proposed Hugh for process fidelity |
| Data agent | `artifacts/api-server/src/goodwill/data/**`, `artifacts/api-server/tests/data/**`, `lib/db/src/schema/goodwill-v2.ts`, `lib/db/migrations/**`, `docs/goodwill/data/**` | lead; proposed Landon for data controls |
| Application/design agent | `artifacts/goodwill/src/features/reporting/**`, `artifacts/goodwill/src/features/reporting-tests/**`, `docs/goodwill/application/**` | lead; proposed Peyton for operator UX |
| Independent QA | `docs/goodwill/verification/**`, `scripts/goodwill-verify-*`, independent test-only files agreed with lead | lead/human teammate; never same implementation driver |
| Lead | OpenAPI, generated outputs, root packages/lockfiles, artifact config, routes, app shell, database barrel and final integration | repository owner/human PR reviewer |

Human reviewer proposals are not confirmed allocations. Confirm personally before
claiming a human reviewed anything. Collaborators exist on the target, but no
contributor branch or open PR was present at the audit. Recheck before dispatch;
if work appears, reserve around it rather than overwrite it.

## Lane handoff details

All lanes read SCOPE, SOURCE_SEMANTICS, CONTRACT_V2 and STORY_COVERAGE.
Test against generated schemas and labelled v2 examples. Use original fixture
bytes and independent controls. Do not edit fixtures, legacy thin path, other
lanes, shared contracts, lockfiles, app shell or global routes.

Acquisition exports a replica page and run/history/manual-upload components, and
a run Router + injectable replay/archive/run-repository services. Real browser
download, not direct fixture delivery passed off as automation. Manual upload
uses the data API ticket/PUT/intake contract. It does not create a second parser.

Data exports a v2 Router and injectable archive/intake/run-repository interfaces.
It alone proposes migration contents. It implements all 15 inputs and opt-in
fixture dispositions. Lead registers schema barrels and routes. No schema push
on an existing DB until migration effects have been reviewed.

Application exports reporting pages with source-local filters, history,
reconciliation, customers/listings/snapshot, evidence and export states.
It uses generated client helpers; test fixtures must never be runtime fallbacks.
Lead integrates routes/components into the existing app shell. Existing branding
is retained; this is not a second app.

Each handoff reports exact changed paths, commands/results, expected-versus-actual
controls, API interactions, remaining limitations and shared changes requested.
Checkpoints: interface adherence before broad code; parser/replay/UI tests;
reviewed integration; independent full regression. No autonomous merge.

## Execution and stop controls

User requested parallel work after the foundation. Native helper-job execution,
waiting and cancellation are available in this workspace. This does not prove
the user's paid plan allowance, remaining credits or account-specific concurrency.
No numeric remaining budget or spend cap has been exposed; do not invent one or
promise automatic dollar enforcement.

Official Replit documentation checked during foundation work states that Pro
supports up to ten parallel Agent tasks and user-configured spending controls.
That general plan limit is not evidence of this account's remaining allowance,
actual plan, approved cap or availability of ten workers in this session.

Use at most the three requested implementation helpers when work is assigned;
QA can prepare independently. Helpers are supervised and bounded to their task.
Do not start an unattended external runner, scheduler, paid model service or
purchase. Stop on requested cancellation, unsafe data, conflicting reservations,
contract drift or missing authorization. Cancel active helper jobs with their
actual job IDs; stopping a helper is not a rollback of its existing changes.

Shared event deadline and spend approvals remain unconfirmed. Record actual
elapsed progress and review checkpoints, not made-up hard budget enforcement.
This does not block supervised work already authorized by the user.

## Review and release

Lead checks combined types/builds, legacy compatibility, exact replay/overlap/
correction races, all source controls, browser acquisition failures, mobile/desktop
views, exports and reload persistence. Human reviews target PR before merge.
No publishing, submission, external messages or accounting actions are included.
When the foundation task is complete, release the already-existing downstream
tasks through the project execution flow; queued tasks are not active workers.