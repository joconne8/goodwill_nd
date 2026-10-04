# Goodwill access-control review — independent technical evidence

Status: focused independent checks completed. This is a technical review, not
human approval, partner sign-in acceptance, or authenticated UI verification.
The private operator configuration was not read, copied, or inferred.

## Checks performed

Ran:

```sh
node scripts/goodwill-verify-independent-access.mjs
```

Result: PASS, 5 independent checks:

- Policy tests require a matching verified session/account ID, the configured
  verified primary email, and an unset configuration to deny; secondary-only,
  mismatched, unverified, banned, and locked cases deny.
- A mocked Clerk client verifies concurrent checks on one request share one
  lookup, while a new request fetches fresh account state and observes changed
  ban/lock state.
- Capability checks verify one-use consumption, expiry after the 70-second
  lifetime, and explicit revocation.
- Destination testing uses only an explicitly injected synthetic URL and
  verifies its origin is derived from server configuration.
- Source-wiring checks verify the origin guard precedes `/api/goodwill/access`
  and capability consumption, credentialed CORS is limited to the configured
  origin, all explicit foreign Goodwill Origins are rejected, forwarded headers
  do not define Goodwill origin policy, and the exact legacy `POST /report`
  capability exception remains scoped. They also verify mandatory v2
  authorization, legacy routes behind the outer guard, query invalidation on
  denial/error, and lazy Clerk module loading outside the public replica branch.

The source-wiring checks are static inspection, not an end-to-end HTTP test of
the running deployment. Main-agent-reported API tests and unauthenticated
endpoint results are not counted here as independently rerun.

## Review of addressed findings

### 1. Credentialed CORS and Goodwill Origin handling

The repaired `app.ts` now configures credentialed CORS against
`approvedAppOrigin`, loaded from `GOODWILL_REPLICA_URL`. Its Goodwill guard
rejects every explicit foreign Origin for both reads and mutations, and rejects
mutations with no Origin. This guard executes before the public access endpoint
and before internal capability consumption. Goodwill origin decisions no
longer use incoming Host or forwarded protocol/host headers. The earlier
cross-origin data disclosure and forwarded-header origin-spoofing findings are
resolved by source inspection and isolated static/config tests.

The main agent will run live foreign-Origin and forged-forwarded-header HTTP
checks; this review did not run the managed service or independently observe
those responses. The Clerk proxy/key-selection use of forwarded host remains
separate from Goodwill origin policy and was not altered by this repair.

## Other scoped observations

- The internal capability is random, single-use, expires after 70 seconds, and
  is revoked when its browser context closes. The app accepts it only for the
  exact `POST /api/goodwill/report` path; the origin guard now runs first, and
  v2 remains behind its own mandatory guard.
- `OperatorGate` removes report queries on denial **and** on access-check
  errors, and will not render protected children from stale approved query
  data. Identity changes clear the query cache.
- Clerk routes and `OperatorGate` are dynamically imported only in the
  non-replica branch. The public replica branch therefore does not evaluate the
  Clerk publishable-key module or instantiate Clerk resources.
- No authenticated UI or actual partner sign-in was tested or accepted. The
  configured private email remains outside this review.