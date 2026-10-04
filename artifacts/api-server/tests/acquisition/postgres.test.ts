import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { PostgresRunRepository } from "../../src/goodwill/acquisition/postgres";
import { request } from "./helpers";

test("Postgres repository persists between adapters, arbitrates retry races and interrupts unfinished runs", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Connection-local TEMP table; never changes shared schema or legacy publications.
    await client.query(`CREATE TEMP TABLE goodwill_acquisition_runs (
      id text PRIMARY KEY,state text NOT NULL,retry_of text UNIQUE,document jsonb NOT NULL
    ) ON COMMIT DROP`);
    const a = new PostgresRunRepository(client), b = new PostgresRunRepository(client);
    const at = new Date().toISOString();
    const run = { id: "persistent-test", request, state: "queued" as const, createdAt: at, updatedAt: at,
      attempt: 1, lastStep: "queued", artifact: null, failure: null, contractVersion: "2.0.0" as const };
    await a.create(run); assert.deepEqual(await b.get(run.id), run);
    assert.equal(await b.replace({ ...run, state: "running" }, ["queued"]), true);
    assert.equal(await a.replace({ ...run, state: "verified" }, ["queued"]), false);
    const retry = { ...run, id: "retry-test", request: { ...request, retryOf: run.id }, attempt: 2 };
    await a.create(retry);
    // Duplicate causes a PostgreSQL transaction error: isolate the intentional failure.
    await client.query("SAVEPOINT duplicate_retry");
    await assert.rejects(b.create({ ...retry, id: "retry-test-2" }), { code: "RETRY_ALREADY_USED" });
    await client.query("ROLLBACK TO SAVEPOINT duplicate_retry");
    await b.interruptUnfinished(at);
    assert.equal((await a.get(run.id))?.failure?.code, "RUN_INTERRUPTED");
    assert.equal((await a.list(0, 10)).total, 2);
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});