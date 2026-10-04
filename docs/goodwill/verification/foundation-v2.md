# Broader foundation verification

This verifies contracts and the existing runnable thin slice, not downstream v2
feature completion. No parallel implementation agent has been launched at this
checkpoint; the existing dependent tasks cover that implementation and final QA.

- Target GitHub main/branches/open PRs/issues/collaborators inspected with authenticated access.
- Current master synthesis and corrected brief read directly from Drive.
- All 70 current backlog stories mapped to driver/reviewer, evidence, disposition
  and the original acceptance requirements.
- All 15 base datasets / 27,544 records have explicit roles and independent controls.
- 24 bundled fixture-pack files compared with target Git object identities:
  19 CSV files differ solely in historical CRLF versus target LF endings;
  five non-CSV files match exactly. No fixture contents regenerated.
- All supplied manifest monetary controls independently recomputed with Python Decimal.
- Separate source-local item-sales controls and three selected-snapshot controls passed.
- All 10 upstream fixture tests passed, including financial formulas, daily
  customers/listings, complete snapshots, exceptions, increments and replay.
- 13 API tests passed: ten legacy tests plus v2 examples/state/null/integer
  validation. v2 examples are test-only, not returned by the application.
- Full workspace typecheck passed; web and API production builds passed.
  Vite emitted an existing tooltip sourcemap warning; it did not prevent build.

## Problems caught and resolved

The API package previously had no test script, so `pnpm ... test` did not execute
the intended suite. A real test runner now bundles and runs both test files.
The contract generator accepted fractional numbers for OpenAPI integers unless
`multipleOf: 1` was carried through; the input transform now preserves integer
and safe-range constraints. This is covered by a negative test.

## Explicit remaining verification gates

The live thin-path smoke and preview checks are recorded with the foundation
handoff. Actual browser replay, all-source database intake, approved corrections,
UI states for new reporting, persistent raw object storage and end-to-end v2
regression remain downstream work. A build or schema-example test is not their
acceptance evidence.

Fresh-clone commands support Linux x64/WSL with an independently configured
PostgreSQL DB; native other platforms and a second human/laptop are not claimed.
The repository PR remains reviewable and unmerged. Human allocations, spend
limits, event timing, publishing and submission approvals remain external gates,
not reasons to delay already-authorized supervised implementation.