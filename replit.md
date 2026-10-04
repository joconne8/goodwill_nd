# Goodwill Reporting

Current scope and repository authority: `docs/goodwill/SCOPE.md` and
`joconne8/goodwill_nd`. Use contract 2.0.0 and `PARALLEL_BUILD.md` for new lanes;
legacy 1.0.0 runtime remains supported. Earlier narrow scope/assignment packets
are historical. Full eligible multi-source reporting is the deliverable.

Synthetic, supervised report-to-total foundation for Goodwill Michiana. Acquire reports, validate data, then expose trustworthy reporting; no live marketplace or accounting posting.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle, synthetic CSV bundled as text)

## Where things live

- `docs/goodwill/BUILD_SUMMARY.md`: team kickoff, full supplied-data coverage audit, outstanding scope decisions and GitHub-first build sequence.
- `docs/goodwill/FOUNDATION.md`: evidence authority, metric dictionary, source matrix, ownership, contracts and open launch gates.
- `docs/goodwill/handoffs/`: three independent implementation lane packets; no jobs dispatched.
- `docs/goodwill/DEMO.md`: supervised skeleton and downstream independent reviewer checks.
- `artifacts/goodwill/`: root-path React web app; `artifacts/api-server/`: shared `/api` service.
- `lib/api-spec/openapi.yaml`: executable contract; generate client/Zod outputs, never hand-edit them.
- `docs/goodwill/evidence/github/goodwill/synthetic-data/`: unchanged merged upstream fixture pack and tests.

## Architecture decisions

- Current Drive stakeholder evidence and acquisition-led synthesis supersede the old dashboard-first PRD.
- Demo net item sales means item gross sales minus item refunds; not the fixture's source net-sales/payout formula.
- Use deterministic calculations, never an LLM for financial arithmetic. Missing inputs are unavailable, not invented zeroes.
- Lead owns contracts, generated clients, lockfiles and entrypoints; one data owner owns migrations. No unattended cross-lane merges.

## Product

Select an August 2026 period, generate/download the synthetic Upright CSV, explicitly import the unchanged file and inspect persisted totals, identity, supporting rows and coverage. This does not yet automate portal retrieval or replace Goodwill's existing Power BI.

## Gotchas

- Run codegen after OpenAPI changes; keep shared contracts under one owner.
- Coordination is GitHub-first with supervised human review; see `ProjectManagement/agent-assignments/TEAM_ASSIGNMENTS.md`. Before unattended work, obtain lead acceptance and verify runner review/apply/cancel, real deadlines and budget controls. Native runner verification is not required for supervised GitHub work.
- No live credentials, restriction bypass, unapproved model provider, production DB change or financial posting.
- Verify via `pnpm run typecheck`, bundled API unit tests and `python scripts/goodwill-foundation-smoke.py`; original upstream fixture tests run from their directory without regenerating fixtures.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
