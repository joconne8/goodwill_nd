# Shared integration checkpoint — 2026-10-04 UTC

This is **not whole-delivery acceptance**, a human review, an accepted GitHub
commit, a live-source integration or a release. The current assigned integration
work remains in progress.

## Applied and technically verified

- Lead reviewed the existing development database and the additive SQL transaction,
  then applied the nine-table migration. No tables were dropped, foundation data
  rewritten, database replaced or startup migration added.
- Registered the Drizzle barrel, installed pinned GCS/auth/Playwright dependencies
  and the approved Nix Chromium package. The real SDK facade adapts current
  Playwright returns and rejects unsafe numeric object generations.
- Shared runtime uses permanent PostgreSQL metadata and the official
  sidecar-authenticated GCS client, immutable private archive and ephemeral
  upload signing. Acquisition's verified-run resolver feeds the common intake.
  There is no runtime local/in-memory archive, fixture seed or mock API fallback.
- Mounted both v2 routers behind a deny-by-default authorization boundary.
  Mounted `/reports` and the public synthetic `/replica/upright`; configured
  the generated client's artifact base path. Retained the legacy home and added
  navigation to the full application.
- The data owner corrected file replay identity to include both period endpoints.
  The independent checker accepted the correction: wrong-period quarantine stays
  immutable; corrected full-August eBay bytes publish 900 rows/$55,515.26;
  accepted same-scope replay remains duplicate; malformed different-period bytes
  are revalidated and cannot replace last-good. See
  [independent review](../independent/phase1-evidence.md).

## Real cloud/database evidence

`node scripts/goodwill-verify-cloud.mjs --confirm-synthetic-only` is an explicit,
supervised **write** check, not startup seeding or an external authorization bypass.
It signs upload tickets, sends original fixture bytes via actual HTTPS PUT, calls
common intake, rereads every immutable cloud object, and queries the permanent
repository. Its output is [cloud-check.json](cloud-check.json).

- All 15 unchanged original input files published, totaling 27,544 accepted rows.
- Database observation: 15 batches, 15 publications, 15 archive metadata entries
  and 27,544 row dispositions.
- Backend source-local controls (USD): Upright net items $36,157.10; eBay net items
  $55,515.26; ShopGoodwill net items $111,262.18; shipping expense $32,814.19;
  FedEx expense $20,121.04. These are **not a cross-source total**.
- Actual signed-PUT browser preflight returned 200 and permits `content-type`.
  **Current bucket CORS is wildcard**, with GET/HEAD/PUT/POST/DELETE advertised.
  No origin-restriction claim is made. Bucket administration returned 403;
  object CRUD and upload signing nevertheless worked. Private object access
  still depends on credentials or a short-lived signed capability, not CORS.
  Tightening bucket CORS requires an approved administrative mechanism.

## Commands and visible runtime

- `pnpm run typecheck` — PASS across libraries and all artifacts/scripts.
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/goodwill run build` — PASS;
  Vite reported a non-fatal tooltip source-map warning.
- Restarted the existing API and Goodwill workflows after the code/package batch;
  both came up running with clean startup logs.
- Managed-host `GET /api/goodwill/v2/catalog` — 401 `OPERATOR_AUTH_REQUIRED`.
- Managed-host `GET /replica/upright` — 200.
- `/reports` screenshot — real route renders, clearly shows access denied and
  unavailable catalog; it does not invent zero totals or sample financial data.
  This verifies an anonymous failure state, **not the signed-in application**.

## Still required before completion

1. Restricted synthetic policy is now approved and implemented with cookie-session
   Clerk sign-in; see [authorization checkpoint](AUTH.md). Only the approved
   partner and subsequently approved creator are eligible by exact verified
   primary email. Both private configuration fields are saved and loaded after
   an API restart. Actual authenticated acceptance remains pending.
   Missing original partner configuration denies everyone.
   Persona labels do not authorize anyone.
2. Actual authenticated browser acquisition → original private archive → common
   batch → publication → filtered UI → immutable row evidence/export continuity.
   The cloud check above is manual intake; it does not prove this browser chain.
3. Integrated adversarial cases, reload/restart durability, final credential scan,
   canonical aggregate validation and independent-browser/fresh-clone checks.
4. Update final story coverage/runbooks and put the combined candidate in the
   target repository for human review. No merge, publish, submission or human
   acceptance has occurred.
5. Recording/submission remains human-controlled; do not manufacture a recording,
   second-device observation or external approval.

Prior acquisition/data/application lane handoffs are historical checkpoints.
Use this document for later shared-wiring facts; their mock/test-harness evidence
still does not certify the authenticated permanent runtime.