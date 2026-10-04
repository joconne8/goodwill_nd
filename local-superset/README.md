# Goodwill local Superset pilot

This optional, loopback-only Docker pilot supplements the existing Goodwill
Reporting and Analytics applications. It receives only a manually downloaded,
versioned synthetic aggregate snapshot from the protected Analytics endpoint.
It does not connect to either managed database or operational tables.

## Requirements

- Docker Engine and the Docker Compose v2 plugin on Linux or WSL2, or Docker
  Desktop with its Linux-container engine enabled.
- Python 3 on the host for generating local credentials; no host PostgreSQL,
  Superset installation, or application migration is required.
- A signed-in operator already approved by the Goodwill app. The first local
  Superset account must be that operator; at most one additional already-approved
  operator can be created.
- The same private runtime values for `GOODWILL_DEMO_OPERATOR_EMAIL` and
  `GOODWILL_DEMO_ADDITIONAL_OPERATOR_EMAIL` that enforce the existing Goodwill
  demo allowlist. Do not put those addresses in tracked files.

The Compose file binds the web port to `127.0.0.1:8088` only. PostgreSQL ports
are not published. Do not change the bind address or expose these services to a
network. Superset is not an SSO integration: its password is local to this pilot
and separate from the Goodwill app password.

## First start

From the repository root:

```sh
sh local-superset/scripts/setup.sh
cd local-superset
docker compose --env-file .env up -d --build
```

The setup script creates a private, ignored `.env` with distinct random values
for the reporting database owner, snapshot importer, Superset read-only
connection, Superset metadata connection, and Superset signing key. It prints
none of those values. Keep `.env` and Docker volumes private; do not put them in
Git, screenshots, support tickets, or shell history.

Compose runs a one-shot initializer after it confirms both databases accept
connections. It migrates Superset metadata, initializes Superset's built-in
roles, registers the three curated views and provisions the reproducible dashboard.
The Compose health checks also report database and web readiness. The two
PostgreSQL containers use separate persistent volumes: `reporting-data` holds
curated imported snapshots; `superset-metadata` holds Superset users and
dashboard configuration.

Create local accounts only after the dashboard is healthy:

```sh
sh scripts/create-approved-operators.sh
```

Enter the exact approved primary-email addresses already authorized by the
Goodwill application—never a new or generic account. The script checks each
email against the existing runtime allowlist; the primary operator is the only
local Superset administrator and the optional second operator receives the
read-only dashboard role. Registration is disabled. The script prompts for
new, local-only passwords without echoing them, and does not reset existing
accounts. Do not type Goodwill or Replit passwords here. Superset has no
anonymous/public dashboard role.

Open <http://127.0.0.1:8088/superset/dashboard/goodwill-local-pilot/> and sign
in with one of those local accounts. An empty dashboard before its first import
is expected; no demo numbers are inserted at startup.

## Download, import and refresh

1. Sign in to the existing Goodwill Analytics app using an approved operator.
2. Choose one supported source, date period and optional store scope. Turn off
   any inventory-snapshot option. Choose **Download Superset snapshot**.
   Unsupported scopes fail instead of producing a blank or misleading export.
3. Move the downloaded JSON into `local-superset/snapshots/`, then run:

   ```sh
   sh local-superset/scripts/import-snapshot.sh local-superset/snapshots/goodwill-superset-shopgoodwill-2026-08-01-2026-08-31.json
   ```

4. Reload the dashboard. To refresh, download a new snapshot and repeat the
   import command. There is no scheduler or live connection.

The importer checks the exact schema version, bounded fields, source/metric
compatibility, safe integers, period and point grain, snapshot checksum and
duplicate/replay identity before writing. It inserts one entire snapshot in a
single database transaction. A rejected file or failed database insert rolls
back completely, so the most recent complete dashboard remains visible. Exact
replays are no-ops. History is retained; the curated views choose the latest
publication/export for each exact source/date/store scope, so importing an
older export later does not replace a newer publication.

The checksum detects accidental corruption only. It is not a digital signature,
proof of origin, or evidence that a source report is complete. Import only the
file you just downloaded from the protected Goodwill Analytics UI. No raw
intake, rejected rows, buyer/customer IDs, employee IDs, or row-level data are
in the export or reporting database.

## Dashboard semantics and limits

- The single-select **Exported source / period / store scope** filter selects an
  exact imported scope; it is not an arbitrary date filter. Changing scope
  means exporting and importing that scope first.
- Sales and expense lines are separate by source, metric and scope. Their
  predefined `MAX(value)` metric is intentionally non-additive; it does not
  total across sources, periods, stores or snapshots.
- Customer counts are daily platform-local distinct counts. They are not
  summed and are not a period-unique buyer estimate.
- Statement-month sources require a complete statement month. Unavailable
  values remain null and visibly unavailable; missing coverage is not zero.
- Coverage/status and snapshot tables show metric definitions, units,
  publication/export/import timestamps, snapshot age, warnings and synthetic
  status. Export age is not silently refreshed on import.
- Superset connects as `goodwill_superset_reader`, which can select only the
  three curated views. It cannot read snapshot tables, metric tables, raw
  operational data or database administration objects. Its database settings
  also disable SQL Lab exposure, uploads, CTAS, CVAS and DML. The importer has
  separate credentials and no read access to Superset metadata.

Neither the Superset UI nor these exported snapshots replace the existing
Goodwill Reporting and Analytics services or change their authoritative
calculations.

## Stop, restart, backup and remove

```sh
# Stop containers but preserve both named data volumes.
docker compose down

# Restart; initialization has already completed for the persistent metadata DB.
docker compose up -d

# Backup each database before moving/removing the local volumes.
docker compose exec -T reporting-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U reporting_owner -d goodwill_reporting' > goodwill-reporting.sql
docker compose exec -T metadata-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U superset_meta -d superset' > superset-metadata.sql
```

Store backups as private synthetic data. Restore to a matching fresh stack with
`psql` using the same database roles before starting Superset. To remove all
local pilot databases and dashboard accounts, stop Compose and explicitly remove
its volumes with `docker compose down --volumes`; that permanently deletes both
databases. Back up first if any imported history or Superset configuration is
needed. The ignored snapshot files under `snapshots/` must be removed separately.

## Verification notes

Repository tests cover protected downloads, denied access, publication
consistency, exact aggregate reconciliation, statement-month restrictions,
daily customer grain, missing versus zero values, checksum validation,
duplicate imports, atomic rollback, dashboard scope selection and negative
database privileges. Running Compose verifies the local Docker dashboard;
opening the dashboard as a human operator still requires one of the approved
operators to create the local account as described above.
See [VERIFICATION.md](VERIFICATION.md) for the checks run in this workspace and
the remaining signed-in verification prerequisite.

To run importer and read-only-permission integration checks against the local
reporting database, run this from `local-superset/` after startup:

```sh
docker compose --env-file .env --profile tests run --build --rm pilot-tests
```

The tests use clearly marked synthetic test rows outside the normal 2026 demo
period, exercise idempotency and a forced mid-transaction failure, then remove
only rows bearing the test publication prefix. No application or reporting
volume is truncated.