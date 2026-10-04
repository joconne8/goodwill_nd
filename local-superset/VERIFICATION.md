# Local Superset pilot verification

Checked in the Replit workspace on 2026-10-04. This records repository and
container evidence; it is not a production certification.

## Passed

- API server typecheck and 22 API tests passed.
- All 8 Goodwill Analytics tests passed, including approved/denied snapshot
  access, aggregate reconciliation, publication consistency, statement-month
  restrictions, unsupported store scopes, and daily customer grain.
- Goodwill Analytics production Vite build completed.
- The pinned Superset 4.1.1 image initialized its metadata database and
  provisioned the dashboard, four charts, and one exact exported-scope filter.
- Both isolated PostgreSQL databases accepted direct application connections.
- All 7 importer tests passed, including checksum/scope validation,
  unavailable-versus-zero values, replay protection, atomic rollback, and
  negative grants proving the reader cannot query base tables.
- Superset returned HTTP 200 from `/health`; an anonymous dashboard request
  returned HTTP 302 to the login flow. Docker exposed port 8088 on
  `127.0.0.1` only.
- A synthetic unapproved local-account request was rejected by the configured
  approved-operator allowlist; no account was created.

## Not verified here

- This nested Docker host reported database health checks as unhealthy and the
  web health check as still starting, even though direct database connections
  and the Superset HTTP health endpoint succeeded. Do not treat those Docker
  health status labels as evidence that the database or web service was
  unreachable.
- No approved human operator account was created, and no signed-in Superset
  dashboard session was available. Follow the local account setup instructions
  and verify the signed-in view on the operator's own Docker host.
- The Analytics browser preview showed its public sign-in landing page, not the
  signed-in download control. API tests cover the protected export contract;
  they do not replace a human sign-in check.
- No snapshot was imported, so the dashboard remains empty until an approved
  operator downloads and imports a supported synthetic snapshot.