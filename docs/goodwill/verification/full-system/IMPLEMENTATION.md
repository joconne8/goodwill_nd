# Connected full-system implementation

The reporting application is now the default entry point. The foundation remains
at `/foundation`; both financial applications and acquisition require the existing
exact approved-operator authorization.

- Nine-source overview: real source-local financial queries for the applied
  period, separate all-time intake counts, publication/evidence links, no combined
  cross-source total. Supporting datasets are separate.
- PostgreSQL view: actual counts for ten existing tables, source batch lineage
  and accepted/rejected evidence. Metadata includes JSONB; this is not an invented
  fully normalized accounting warehouse.
- Query assistant: same deterministic financial services, immutable citations,
  current source/date/store/metric/group context, stale-response rejection and
  read-only tool discovery. No external model is called.
- Jev prototype: authenticated experiment adapter, append-only review metadata,
  explicit operator approval and bounded replay. A loopback bundle reuses the
  existing ReplicaPortal with exact route/asset/Host/Origin restrictions.
  Discovery execution is injectable but absent in runtime until separately
  authorized. No previous one-call budget is reused.

## Verification boundaries

`scripts/goodwill-verify-full-runtime.mjs` passed against the existing PostgreSQL
database: all nine sources had published accepted records and produced cited
assistant answers; five unsupported/unsafe question classes were refused.
Connections were read-only, with no seed/import/model execution.

`scripts/goodwill-verify-full-system.mjs` passed all seven browser subtests:
nine-source reporting, database/lineage, context-bound answers, evidence
navigation, in-flight stale response rejection, refusal/error states and Jev
navigation. Repository/archive and SQL adapters in this isolated harness are
test doubles, not claims about signed-in managed UI acceptance.

The assistant suite passed 14 tests and API/contract suite passed 22 tests.
Workspace typechecking passed. The complete acquisition suite passed 28 tests
with zero skipped: real Chromium download, scripted discovery, verified archive,
explicit recipe approval, restart-persistent review and model-free replay.
This is actual browser execution with a scripted decision provider, not Jev
provider execution.

Final-review regression: the browser adapter now exposes code-owned observation;
semantic control equality survives PostgreSQL JSONB key ordering without changing
stored approval digests. The regression uses the actual `goodwillBrowser` adapter
and PostgreSQL metadata in a rollback-isolated temporary table—not a file store—
through scripted discovery, approval, reconstructed review and replay. It also
rejects extra/mutated control fields and preserves approved-version identity.

Both managed workflows restarted successfully. The `/reports` screenshot renders
the expected operator sign-in gate. Anonymous overview, tool-discovery and
experiment requests each returned 401. The protected signed-in application was
verified in the isolated browser harness, not in a managed operator session.

## Remaining approval gates

- Actual paid Jev discovery requires new explicit authorization and evaluated
  model/source policy. No real-provider run occurred in this build.
- Managed signed-in browser acceptance still requires an approved operator
  session; authorization has not been weakened to manufacture this evidence.
- Eight non-Upright inputs use file intake, not eight newly built live browser
  connectors. Nine-source automation expansion remains separate work.
- Production AI/Copilot, real vendor credentials and accounting posting remain
  outside the synthetic authorization. No GitHub merge, deployment or submission
  was performed.