# Immutable application lane packet — foundation 1.0.0

> Historical packet. Use ../SCOPE.md, ../CONTRACT_V2.md and ../PARALLEL_BUILD.md.
> Customer/listing/backlog views, exports and history are current build scope,
> not optional P1. Current ownership paths supersede those below.

Release status: **blocked until lead accepts foundation and launch gates are verified**. Requirements APP-01–03; export subset is optional P1. Goal: operations, leadership and finance evidence views driven by the acquired/imported file, not a separate dashboard dataset.

## Ownership and baseline

Own new `artifacts/goodwill/src/views/` and view-specific components/styles/tests. Do not edit replica, backend, database/migrations, shared API/client code, manifests/lockfiles, `App.tsx`, shared `index.css` or the foundation `home.tsx` shell. Propose shell/route integration to the lead.

Read `../FOUNDATION.md`, generated client/types, and `../contracts/examples/`. Actual hooks are `useGenerateGoodwillReport`, `useImportGoodwillReport`, `useGetGoodwillLatest`, `useGetGoodwillSources` and their generated query keys. Return objects are direct, not wrapped. Use approved richer interfaces only after lead codegen.

## Acceptance

- Operations: period, source/run/file readiness, freshness, missing coverage, actionable acquisition/import exceptions and the approved retry/manual path.
- Leadership: period/scope filtering, published figures/definitions, unavailable strategic-KPI scorecard. No fabricated missing financial inputs, forecasts or unapproved e-commerce sell-through target.
- Finance: source identity, checksum/batch/metric versions, reconciliation evidence and rows supporting the exact displayed sum. No posting actions.
- Loading/empty/partial/stale/error states; failure is not replaced by development fixtures. Synthetic and replica labels persist.
- Mutation outputs remain visible after navigation/reload and across sessions; invalidate affected queries and provide a finite freshness path.
- Date/scope filters agree with backend/row evidence. Net = item sales − item refunds; exclude shipping/tax/premiums/fees.
- Responsive keyboard-accessible views, no emojis. Informational persona views are not claims of server-enforced security roles; sign-in/role scope is not approved.

Development fixture responses must validate against frozen generated schemas and remain test-only. No unimplemented route calls or custom local financial calculation. P1 richer four-view dashboard/export/assistant cannot block the one-source P0.

Commands: `pnpm run typecheck`, frontend build and own view/browser tests. Ask the lead to restart/integrate shared services. Limits: suggested 60-minute checkpoint/two failed repairs; deadline/caps unconfirmed. No unattended start or external publishing.

Return `docs/goodwill/reports/application.md`: changed files, executed checks, screenshots at desktop/mobile, filter/evidence agreement, accessibility/state cases, API needs and blockers. Lead integrates shell changes and humans review/apply the output.