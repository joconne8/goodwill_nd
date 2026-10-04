# Focused Codex brief

## Opening prompt

> This project has become overdesigned. Help me simplify it, not expand it.
> Read docs/handoff/README.md and local-superset/README.md first. My immediate
> goal is a clear local Apache Superset demonstration using the existing
> approved synthetic data. A Power BI-style mockup is only a visual comparison,
> not a second production application.
>
> Inspect the repository and propose the smallest viable path. Preserve the
> working code as a baseline. Do not delete major modules or swap libraries
> without explaining the consequences and getting my approval. Prefer the
> existing Superset pilot over another custom dashboard, new framework or
> automation layer. Verify each agreed change with the relevant existing tests.
>
> Keep published source-local figures distinct from enterprise revenue and
> missing data distinct from zero. Do not widen approved-account access, commit
> secrets, call paid AI/live vendors, import real data or deploy anything without
> explicit authorization. Be clear about what actually runs locally versus
> what is only documented or tested with doubles.

## First objectives

1. Verify the local Superset stack and read its recorded limits.
2. Obtain/import one approved synthetic aggregate snapshot using the existing
   documented workflow. If none is available, explain the prerequisite rather
   than manufacturing a trusted export or bypassing the application.
3. Verify the dashboard as an approved local operator and check that the chart
   values reconcile to the imported snapshot.
4. Explain which larger application services are unnecessary for this demo.
   Propose simplifications; do not start a broad rewrite.

## Constraints worth preserving

- Source reports overlap and mix sales, settlements and expenses. Do not add
  them into an invented enterprise revenue total.
- Payout is not profit. Margins need approved costs and allocation rules.
- Receipt timestamps do not establish donation timestamps.
- Period repeat buyers do not establish lifetime loyalty or new-buyer status.
- Sell-through and unsold/relisted percentages need explicit inventory cohorts.
- Original sample files have controlled hashes: preserve their bytes.
- Superset receives a manually imported synthetic aggregate snapshot, not
  operational tables, buyer IDs, employee IDs or raw intake.
- The current Superset pilot covers a limited curated view, not every requested
  KPI. All-KPI synthetic augmentation is a separate, explicitly agreed step.

## Defer unless specifically requested

Live vendor acquisition, paid Jev/model experiments, additional dashboards,
slides/design variants, broad platform migrations, new roles or multi-tenancy,
and a new cost/labor data model. None is necessary merely to inspect the code
or start the local Superset pilot.

## Useful checks

The merged baseline currently fails the workspace typecheck on
before-declaration references in the generated Superset snapshot validators
(`lib/api-zod/src/generated/api.ts`, TS2448/TS2454). Inspect the API generation
toolchain and fix the generation/order problem rather than editing arbitrary
generated lines or assuming the archived source is already typecheck-clean.

```sh
pnpm run typecheck
node artifacts/api-server/tests/analytics/run.mjs
```

For local Superset importer/read-only integration tests, after its databases
are running:

```sh
cd local-superset
docker compose --env-file .env --profile tests run --build --rm pilot-tests
```

These integration tests write clearly marked synthetic test rows and remove
only those test rows; they are not read-only checks of production.