# Goodwill - clean source handoff

**Start with [the VS Code/Codex handoff](docs/handoff/README.md).**
This is a history-free current-source snapshot. The next priority is a smaller
local Superset demonstration, not implementation of every historical roadmap.
Read AGENTS.md before making changes.

---

The previous project README is preserved below for technical context. Its
historical setup and acceptance claims are not a turnkey local launch.

# Goodwill Reporting

One synthetic reporting application: React/Vite, Express, PostgreSQL/Drizzle,
OpenAPI-generated clients and validators. Target: `joconne8/goodwill_nd`.
Start with [the current scope](docs/goodwill/SCOPE.md).

Presentation and rehearsal materials:
[Goodwill judge demo package](docs/goodwill/judge-demo/README.md). It separates
official judging/submission rules, verified test evidence, conditional integrated
features and unresolved human approvals; it is not a created deck or recording.

**Deliverable:** the complete reporting system, not a demo webpage. Demonstration
coverage must include all nine business sources, Jev automation, the relational
database, the dashboard and agent-native queries inside the dashboard. See
[full-system acceptance](docs/goodwill/judge-demo/FULL_SYSTEM.md).

**Implemented, not yet fully accepted:** v2 all-source intake, PostgreSQL/private
archive wiring, reporting/customer/listing/backlog views, quarantine, correction
review, exports and the merged Jev acquisition prototype.
**Now implemented:** an integrated read-only, model-free query assistant backed
by the same reporting/evidence services, discoverable agent tools, nine-source
figures and PostgreSQL lineage views. Jev recipe review and replay are wired to
durable metadata and a private loopback bundle of the existing synthetic portal.
Paid Jev discovery is disabled until separately authorized; no LLM or live vendor
execution is implied by the model-free assistant.
Authenticated end-to-end acceptance remains open; the retained single-source
foundation is not the full deliverable.

All supplied data is synthetic. The target's `synthetic-data/` is retained without
modification. The existing runtime references a content-equivalent bundled copy under
`docs/goodwill/evidence/github/goodwill/synthetic-data/`; identity checks prevent
divergence, allowing only the historical CRLF versus target LF newline difference.
Raw intake still hashes exact original bytes. Do not regenerate either pack.

## Replit

Use the existing managed workflows:
- `artifacts/api-server: API Server`
- `artifacts/goodwill: web`

They supply service ports and the web base path. The shared preview proxy routes
`/api` to Express and the app's preview path to Vite. Do not hardcode localhost
or the development domain in browser code. Existing database settings stay in
workspace Secrets; never commit values. The mockup sandbox is design tooling,
not a second reporting application.

## Historical foundation-only Linux x64 launch

The instructions below describe the earlier foundation checkpoint, not verified
full-product setup. Current v2 schema, storage and Clerk authorization requirements
must also be satisfied; do not treat this section as complete-delivery acceptance.

Prerequisites: Node 22+, pnpm 10.26.1, Python 3, and an existing PostgreSQL database
you are authorized to use for synthetic demo data. Linux/WSL is the supported
baseline because the existing lockfile deliberately excludes other native targets.
Native macOS/Windows support is not claimed.

1. Check out the reviewed baseline branch/PR in goodwill_nd.
2. `pnpm install --frozen-lockfile`
3. Create a local, ignored `.env` with `DATABASE_URL` from your approved database.
   Do not copy Replit secrets into a repository or a terminal transcript.
4. Review `lib/db/src/schema/goodwill-publications.ts`. On a **new empty demo DB**,
   run the schema setup using the environment loaded from `.env`:
   `node --env-file=.env scripts/local-db-setup.mjs`
   On an existing DB, review the diff and migrations with its owner first.
5. `node --env-file=.env scripts/local-preview.mjs`
6. Open `http://127.0.0.1:3000`. The launcher routes `/api` and UI on one local
   origin. Ctrl-C stops both child services. Replit does not use this launcher.

The current app requires Clerk configuration and its exact verified-primary-email
operator policy. Do not bypass authorization to reproduce the former public
foundation. See [authorization](docs/goodwill/verification/integration/AUTH.md)
and [integration status](docs/goodwill/verification/integration/STATUS.md) for
implemented wiring and remaining acceptance gaps.

## Verification

Full-system checks (synthetic data only):

```sh
node artifacts/api-server/tests/assistant/run.mjs
node artifacts/api-server/tests/acquisition/run.mjs
node scripts/goodwill-verify-full-system.mjs
node scripts/goodwill-verify-full-runtime.mjs
```

The last command reads existing PostgreSQL data with read-only connections;
it does not seed data, execute a model or certify a signed-in browser session.
Browser harnesses label their repository/archive/SQL doubles explicitly.

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server test
python scripts/goodwill-fixture-controls.py
python docs/goodwill/evidence/github/goodwill/synthetic-data/test_data.py
PORT=3002 BASE_PATH=/ pnpm --filter @workspace/goodwill run build
pnpm --filter @workspace/api-server run build
```

Regenerate contract outputs only after approved schema changes:
`pnpm --filter @workspace/api-spec run codegen`.
Contract example fixtures live in `artifacts/api-server/tests/fixtures/`.
They are test data, not runtime fallback results.

## Safe demo reset

The UI can replay a report without doubling totals; no reset is needed to repeat
the baseline. For an actually clean demo, create a new empty demo database and
apply the reviewed schema, rather than deleting an existing/shared database.
Changing dates selects that period's publication. There is no broad delete/reset
endpoint and no automatic destructive migration in the documented startup flow.

## Optional local BI dashboard

The Apache Superset pilot is separate from the existing reporting products and
uses only authenticated synthetic aggregate downloads. It has no managed-database
connection or automatic refresh. Follow
[the local Superset guide](local-superset/README.md) for Docker startup, approved
operator account setup, snapshot import, permissions, backup and shutdown.

## Review and handoff

See [parallel ownership](docs/goodwill/PARALLEL_BUILD.md),
[source semantics](docs/goodwill/SOURCE_SEMANTICS.md),
[contract invariants](docs/goodwill/CONTRACT_V2.md), and
[all story acceptance criteria](docs/goodwill/STORY_COVERAGE.md).
No live vendor credentials, AI financial calculation, production accounting
posting, autonomous merge or publishing is included.