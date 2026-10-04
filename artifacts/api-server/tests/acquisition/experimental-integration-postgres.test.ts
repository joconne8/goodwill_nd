import test from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import { PostgresExperimentMetadataStore } from "../../src/goodwill/acquisition/experimental/postgres";

test("Postgres experiment metadata is immutable, namespaced, isolated and readable by a new adapter", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE goodwill_v2_audit (id text PRIMARY KEY, document jsonb NOT NULL) ON COMMIT DROP");
    // Only a connection-local temporary table; shared records are not reset.
    const isolatedPool = { async connect() { return {
      async query(text: string, values?: unknown[]) { return client.query(text, values); }, release() {},
    }; } };
    await client.query("INSERT INTO goodwill_v2_audit VALUES ($1,$2::jsonb)", ["data-audit-existing", '{"kind":"publication"}']);
    const first = new PostgresExperimentMetadataStore(isolatedPool), second = new PostgresExperimentMetadataStore(isolatedPool);
    const id = await first.append("repair", { activeRecipeChanged: false, status: "proposed_only" });
    assert.deepEqual(await second.read(id), { activeRecipeChanged: false, status: "proposed_only" });
    assert.deepEqual((await second.list()).map(row => row.id), [id]);
    await assert.rejects(second.read("../private"), { code: "INVALID_REVIEW_ID" });
    await assert.rejects(second.read("recipe-00000000-0000-0000-0000-000000000000"), { code: "REVIEW_NOT_FOUND" });
    const rows = await client.query("SELECT id FROM goodwill_v2_audit ORDER BY id");
    assert.ok(rows.rows.some(row => row.id === "acquisition-experiment-v1:" + id));
    assert.ok(rows.rows.some(row => row.id === "data-audit-existing"));
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});