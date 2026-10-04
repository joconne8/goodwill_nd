# Restricted synthetic demo authorization

The user initially restricted access to one partner email, then explicitly added
the creator's email as a second demo operator. Actual addresses are absent from this
repository. This is not authorization for production data or deployment.

## Runtime policy

- Managed Clerk sign-in uses browser cookies, canonical server middleware/proxy
  and canonical client key/provider/OAuth routing. No browser bearer-token
  workaround, first-user auto-approval or profile/persona permission exists.
- `GOODWILL_DEMO_OPERATOR_EMAIL` must be entered as **private configuration**.
  `GOODWILL_DEMO_ADDITIONAL_OPERATOR_EMAIL` optionally holds the explicitly approved
  creator's address. Each field accepts one exact email, not a list or domain.
  Do not put either value in `.replit`, committed env files, documentation or logs.
  Missing original partner configuration denies everyone. Deployment must not inherit demo approval
  without a separate explicit decision.
- Each financial request checks its verified session ID against a fresh
  server-to-Clerk account result, requires that result's matching ID and exact
  configured **verified primary email**, and rejects banned or locked accounts.
  The promise is reused only within the same request, never cached across requests.
- All v2 operations and retained foundation endpoints require one of these same
  two approved accounts. Anonymous foundation access is not an alternate reporting path.
- CORS allows credentialed reads only from the server-configured app origin.
  All API requests reject an explicit other Origin; browser mutations also reject
  missing Origin. Forwarded Host/protocol headers do not determine this policy.
  Protected API errors do not
  expose configured addresses, raw credentials or account identity data.
- The public homepage provides context, not financial queries. Signed-in accounts
  enter `/reports`; unapproved accounts see a clear restricted-access screen.
  `/foundation` preserves the old workflow for the approved account.
- Logout/account changes clear the query cache; the operator gate hides reports
  until server approval is confirmed and polls approval again. Account creation
  alone never grants report access.

## Supervised replica exception

The public replica contains simulated controls, not an anonymous financial download.
The already operator-protected server replay issues an opaque, expiring, single-use
capability for its isolated browser. It authorizes **only POST `/goodwill/report`**
synthetic generation. It cannot authorize v2 operations, publication, retained
results, an operator session or any other route. It is revoked when the context
closes and is never persisted/logged. The origin guard runs before capability
consumption. The replica neither loads nor mounts the lazy Clerk modules or their
external browser resources, preserving the constrained same-origin replay.

## Technical checks completed

The two-operator policy passes 19 API tests and five isolated authorization checks.
Both exact verified primary addresses can pass; unrelated, secondary-only,
unverified, locked and banned identities remain denied. The second address is
optional private configuration and never replaces the original partner approval.
The sign-up page renders correctly; adding an address does not create its account.

- Canonical Clerk proxy copied without semantic changes; copied host-key/provider
  wiring and optional wildcard sign-in/sign-up paths.
- Generated the new session-approval API contract/client.
- Root typecheck, 17 API/contract/policy tests and production frontend build passed.
- Policy tests cover exact verified primary match, other identity/email, missing
  config/account, unverified or secondary-only email, banned/locked accounts,
  malformed or multiple-account configuration, and single-use/revoked capabilities.
- Real managed-host observations: access state 200 with false/false; anonymous
  legacy source/latest and v2 catalog requests 401; forged identity/capability
  headers 401; anonymous generation 401; cross-site mutation 403.
- Actual sign-in screenshot shows the themed Clerk form. This does **not** verify
  the approved partner's signed-in UI or positive cookie-session authorization.
- Independent correction review passed five isolated checks; its two initial
  CORS/forwarded-origin findings were addressed. Main then observed actual
  foreign-origin read 403 with no allow-origin header, forged forwarded-host/
  protocol mutation 403, and canonical-origin anonymous access false/false.
- Updated mobile `/reports` screenshot renders a clear sign-in-required state,
  without a financial query or a fabricated zero total. Managed services are
  running; no partner session was used.

Private email entry, the approved partner's actual sign-in/verification and full
file-to-UI acceptance remain required. No completed
whole-delivery, human review, merge, publishing or live access is claimed.