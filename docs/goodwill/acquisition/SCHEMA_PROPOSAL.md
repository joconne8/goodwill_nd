# Acquisition run persistence proposal — review required, not applied

Data lane owns migration implementation; lead owns registration and schema push.
This proposal is deliberately outside `lib/db/`. No runtime module executes DDL.

```sql
CREATE TABLE goodwill_acquisition_runs (
  id text PRIMARY KEY,
  state text NOT NULL CHECK (state IN
    ('queued','running','downloaded','verified','failed','cancelled')),
  retry_of text UNIQUE REFERENCES goodwill_acquisition_runs(id),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object')
);
CREATE INDEX goodwill_acquisition_runs_state_idx
  ON goodwill_acquisition_runs(state);
CREATE INDEX goodwill_acquisition_runs_created_idx
  ON goodwill_acquisition_runs ((document->>'createdAt') DESC, id DESC);
```

- `document` contains the contract-2.0.0 AcquisitionRun metadata. Wire timestamps
  are ISO strings, not JavaScript Date objects. Extra metadata `downloadedAt` and
  `steps: [{name, at}]` preserve actual browser time and replay audit timestamps;
  no extra shared API request parameters are needed.
- Raw CSV, HTML, screenshots, credentials, cookies, presigned URLs and local
  filesystem paths must never enter this table. Files belong in private immutable
  object storage. `artifactId` is an opaque reference supplied by the data owner.
- A unique nullable `retry_of` reserves exactly one explicit retry across racing
  requests. A retry is a new run; it does not reopen or overwrite its predecessor.
- State compare-and-set protects cancellation from late delivery. Run IDs and
  statements use parameters; caller-provided URL/path execution is not accepted.
- `initialize()` marks queued/running/downloaded rows interrupted before accepting
  requests. **Single worker only:** stop the predecessor first. Horizontal
  workers require leases/fencing and are not supported by this implementation.
- A cancellation or process crash during a private object write may leave an
  unreferenced immutable object, never a delivered artifact or publication. Data
  owner may clean such objects using a reviewed retention policy.

## Verification, without shared schema changes

The acquisition PostgreSQL test creates a **connection-local temporary table**
inside a transaction, exercises two repository instances, compare-and-set,
unique retry reservation and interruption, then rolls back. It neither registers
this production table nor changes legacy schema/data.

Lead/data owner must review index/retention costs and migration effects, apply
the approved migration, wire the private archive and test real process restart
against that approved persistent table before claiming integrated persistence.