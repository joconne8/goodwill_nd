-- REVIEW REQUIRED. Not applied automatically; no DROP or replacement of foundation data.
BEGIN;
CREATE TABLE goodwill_acquisition_runs (
  id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('queued','running','downloaded','verified','failed','cancelled')),
  retry_of text UNIQUE REFERENCES goodwill_acquisition_runs(id),
  document jsonb NOT NULL CHECK(jsonb_typeof(document)='object')
);
CREATE INDEX goodwill_acquisition_runs_created_idx ON goodwill_acquisition_runs ((document->>'createdAt') DESC,id DESC);
CREATE INDEX goodwill_acquisition_runs_state_idx ON goodwill_acquisition_runs(state);

CREATE TABLE goodwill_v2_batches (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_rows (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_records (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_publications (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_uploads (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_artifacts (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_audit (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE TABLE goodwill_v2_heads (id text PRIMARY KEY, document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'));
CREATE INDEX goodwill_v2_rows_batch_idx ON goodwill_v2_rows ((document->>'batchId'));
CREATE INDEX goodwill_v2_records_dataset_key_idx ON goodwill_v2_records ((document->>'datasetId'),(document->>'key'));
CREATE INDEX goodwill_v2_batches_received_idx ON goodwill_v2_batches ((document->>'receivedAt') DESC);
-- Raw CSV, base64, signed URLs, cookies and credentials are prohibited in every document.
-- Mutable tables record attempts/review outcomes; immutable tables are append-only through repository.
COMMIT;