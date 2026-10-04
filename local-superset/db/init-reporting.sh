#!/bin/sh
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=importer_password="$REPORTING_IMPORTER_PASSWORD" \
  --set=reader_password="$REPORTING_READER_PASSWORD" <<'SQL'
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA reporting AUTHORIZATION reporting_owner;
REVOKE ALL ON SCHEMA reporting FROM PUBLIC;

CREATE ROLE goodwill_importer LOGIN PASSWORD :'importer_password';
CREATE ROLE goodwill_superset_reader LOGIN PASSWORD :'reader_password';
GRANT CONNECT ON DATABASE goodwill_reporting TO goodwill_importer, goodwill_superset_reader;
GRANT USAGE ON SCHEMA reporting TO goodwill_importer, goodwill_superset_reader;

CREATE TABLE reporting.snapshots (
  snapshot_id char(64) PRIMARY KEY,
  checksum char(64) NOT NULL,
  scope_id char(64) NOT NULL,
  source_id text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  store_id text,
  publication_id text NOT NULL,
  published_at timestamptz NOT NULL,
  exported_at timestamptz NOT NULL,
  snapshot_age_seconds bigint NOT NULL CHECK (snapshot_age_seconds >= 0),
  timezone text NOT NULL CHECK (timezone = 'America/New_York'),
  currency text NOT NULL CHECK (currency = 'USD'),
  synthetic boolean NOT NULL CHECK (synthetic),
  warnings text[] NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date)
);
CREATE INDEX snapshots_scope_imported_idx
  ON reporting.snapshots (source_id, start_date, end_date, store_id, imported_at DESC);

CREATE TABLE reporting.metric_definitions (
  snapshot_id char(64) NOT NULL REFERENCES reporting.snapshots(snapshot_id),
  metric_id text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('usd_cent','count')),
  definition_version text NOT NULL,
  formula text NOT NULL,
  grain text NOT NULL,
  time_basis text NOT NULL,
  availability_reason text,
  status text NOT NULL CHECK (status IN ('available','partial','unavailable')),
  scalar_value bigint,
  coverage jsonb NOT NULL,
  warnings text[] NOT NULL,
  PRIMARY KEY (snapshot_id, metric_id)
);

CREATE TABLE reporting.metric_points (
  snapshot_id char(64) NOT NULL,
  metric_id text NOT NULL,
  point_key text NOT NULL,
  value bigint,
  contributing_rows integer NOT NULL CHECK (contributing_rows BETWEEN 0 AND 20000),
  missing_buyer_rows integer NOT NULL CHECK (missing_buyer_rows BETWEEN 0 AND 20000),
  PRIMARY KEY (snapshot_id, metric_id, point_key),
  FOREIGN KEY (snapshot_id, metric_id)
    REFERENCES reporting.metric_definitions(snapshot_id, metric_id)
);

CREATE VIEW reporting.dashboard_snapshots AS
  SELECT snapshot_id, scope_id, source_id,
         CASE source_id
           WHEN 'cash_monkey' THEN 'Cash Monkey'
           WHEN 'upright' THEN 'Upright'
           WHEN 'jewelry' THEN 'Jewelry'
           WHEN 'shipping' THEN 'Shipping'
           WHEN 'fedex' THEN 'FedEx'
           WHEN 'shopgoodwill' THEN 'ShopGoodwill'
           WHEN 'goodwill_books' THEN 'Goodwill Books'
           WHEN 'ebay' THEN 'eBay'
           WHEN 'amazon' THEN 'Amazon'
           ELSE source_id
         END || ' · ' || start_date::text || ' – ' || end_date::text ||
           ' · ' || coalesce(store_id, 'All stores') AS scope_label,
         start_date, end_date, store_id,
         publication_id, published_at, exported_at, snapshot_age_seconds,
         timezone, currency, synthetic, warnings, imported_at
  FROM (
    SELECT s.*,
           row_number() OVER (
             PARTITION BY source_id, start_date, end_date, coalesce(store_id, '__all_stores__')
             ORDER BY published_at DESC, exported_at DESC, imported_at DESC, snapshot_id DESC
           ) AS scope_rank
    FROM reporting.snapshots AS s
  ) AS ranked
  WHERE scope_rank = 1;

CREATE VIEW reporting.dashboard_metrics AS
  SELECT s.snapshot_id, s.scope_id, s.source_id, s.scope_label, s.start_date, s.end_date,
         s.store_id, s.publication_id, s.published_at, s.exported_at,
         s.snapshot_age_seconds, s.imported_at, s.timezone, s.currency,
         d.metric_id, d.label, d.unit, d.definition_version, d.formula,
         d.grain, d.time_basis, d.availability_reason, d.status,
         d.scalar_value, d.coverage, d.warnings,
         p.point_key,
         CASE WHEN p.snapshot_id IS NULL THEN d.scalar_value ELSE p.value END AS value,
         p.contributing_rows, p.missing_buyer_rows,
         CASE WHEN p.point_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              THEN to_date(p.point_key, 'YYYY-MM-DD') END AS point_date
  FROM reporting.dashboard_snapshots AS s
  JOIN reporting.metric_definitions AS d USING (snapshot_id)
  LEFT JOIN reporting.metric_points AS p USING (snapshot_id, metric_id);

CREATE VIEW reporting.dashboard_metric_status AS
  SELECT DISTINCT snapshot_id, scope_id, source_id, scope_label, start_date, end_date, store_id,
         publication_id, published_at, exported_at, imported_at, metric_id, label,
         unit, status, availability_reason, coverage, warnings
  FROM reporting.dashboard_metrics;

GRANT SELECT, INSERT, UPDATE ON reporting.snapshots,
  reporting.metric_definitions, reporting.metric_points TO goodwill_importer;
GRANT SELECT ON reporting.dashboard_snapshots,
  reporting.dashboard_metrics, reporting.dashboard_metric_status
  TO goodwill_superset_reader;
SQL