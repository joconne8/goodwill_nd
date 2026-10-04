# Upright replica: reference-to-implementation mapping

## Reviewed evidence and limitation

The locally archived screenshot contact sheet and enlarged Reports/Paid orders
images 5 and 7 informed this flow. Separate Drive image assets were not independently
reviewed in this lane; do not claim they were. No human process-fidelity review
has been confirmed.

| Screenshot/process cue | Implemented behavior | Difference disclosed |
|---|---|---|
| Reports navigation and Paid orders | Real buttons open report menu and paid report form | Synthetic recreation, not live portal integration |
| Date inputs | Inclusive calendar start/end, August 2026 | Original fixture scope only |
| Timezone dropdown | Eastern default; Pacific selectable but explicitly rejected | Reviewed screenshots use Pacific; fixture is Eastern |
| Channel/payment filters | All channels/Paid; alternatives produce INVALID_FILTER | No unsupported filter silently applied |
| Generate report | Confirmation modal, then generation state | No email job or live session |
| Past reports/Complete/download | New report appears with completion status, filename and real Blob download | Current-input report only; no fake historical files |
| Orders report naming | “Paid order report” in screenshot-inspired form | Banner explicitly says **paid ITEM grain**, not live order grain |
| Operator exceptions | Expired session, delayed readiness, missing report and actual missing Generate selector | Deterministic test scenarios, not claims about live failure frequency |

The replica uses existing Goodwill typography, spacing, color tokens and controls;
it does not replace global branding or recreate a separate website.

## Replay selectors and real-byte evidence

Stable data-testid controls:
`replica-reports`, `replica-paid-orders`, `replica-start`, `replica-end`,
`replica-timezone`, `replica-channel`, `replica-payment`, `replica-generate`,
`replica-confirm`, `replica-ready`, `replica-download`, `replica-error`,
`replica-manifest`.

- Select values: `America/New_York`, `all`, `paid`.
- DOM drift renames the actual generate control to `replica-generate-moved`;
  replay does not declare success by directly fetching the generator.
- Ready is visible “Complete”; manifest is JSON-only with source/report/dates/
  timezone/synthetic/filename/hash/byte size/legacy contractVersion. No embedded CSV.
- Browser listens for `download` **before** clicking, waits for completion,
  saves to a private randomized temporary directory using a fixed server-owned
  filename, reads actual bytes, then deletes temporary files.
- Verifier uses the unchanged legacy generator/parser/date semantics as its
  synthetic byte oracle, with a separate independent Python record selection
  control. No acquisition financial calculation or new metric definition.
- Any change to inputs invalidates the ready report; no stale download control.
- Wrong dates and failed download are test-only fault scenarios, not additions
  to the frozen public acquisition scenario enum.
- “Download requested” is distinct from browser-confirmed completion. Verified
  acquisition is distinct from intake acceptance/reconciliation/publication.

## Operator/manual fallback

History retains request, status, attempt, created/updated times, last completed
step, safe error/next action and archive identity. A retry creates a linked run
with the same period; form inputs cannot silently change its scope.

Manual selection names source/report from the catalog. Exact selected bytes are
hashed, ticketed, PUT to the server-issued transient URL, then sent to common
batch intake via upload ID. No second parser, arbitrary local path, guessing
source from headers, finance calculation or success metric appears in this lane.

Reference workflow labels come from the source API and remain “Synthetic
supported” or “Not connected”; no live integration/time-saving claim is made.