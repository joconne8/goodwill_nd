import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool } from "../lib/db/src/index";
import { PostgresAssistantUsage, syntheticGrantId } from "../artifacts/api-server/src/goodwill/assistant/usage";

// DEVELOPMENT ONLY. No external model, no financial rows, no real grant spend.
// The optional flag applies just this additive migration, not a global push.
const testGrant = `assistant-limit-test-${randomUUID()}`;
let testRowCreated = false;
try {
  if (process.env.NODE_ENV === "production") throw new Error("Development-only usage verification");
  if (process.argv.includes("--apply-development-migration"))
    await pool.query(await readFile("lib/db/migrations/goodwill-assistant-usage.sql", "utf8"));
  const before = await pool.query("SELECT attempted_calls,reserved_cents FROM goodwill_assistant_usage WHERE grant_id=$1", [syntheticGrantId]);
  const ledger = new PostgresAssistantUsage(pool, testGrant);
  testRowCreated = true;
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => ledger.reserve()));
  const successes = results.filter(r => r.status === "fulfilled");
  assert.equal(successes.length, 5);
  assert.deepEqual(successes.map(r => r.status === "fulfilled" ? r.value.reservedCents : 0).sort((a, b) => a - b),
    [100, 200, 300, 400, 500]);
  for (const r of results.filter(r => r.status === "rejected"))
    assert.equal(r.status === "rejected" && r.reason.code, "MODEL_LIMIT_REACHED");
  // New service instance, same DB grant: exhausted budget stays exhausted.
  await assert.rejects(new PostgresAssistantUsage(pool, testGrant).reserve(), { code: "MODEL_LIMIT_REACHED" });
  const stored = await pool.query("SELECT attempted_calls,reserved_cents FROM goodwill_assistant_usage WHERE grant_id=$1", [testGrant]);
  assert.deepEqual(stored.rows, [{ attempted_calls: 5, reserved_cents: 500 }]);
  const after = await pool.query("SELECT attempted_calls,reserved_cents FROM goodwill_assistant_usage WHERE grant_id=$1", [syntheticGrantId]);
  assert.deepEqual(after.rows, before.rows);
  process.stdout.write("PASS: real PostgreSQL concurrent reservations, five-attempt/$5 cap, restart persistence and unchanged live grant. No model call.\n");
} catch {
  process.stderr.write("FAIL: development PostgreSQL assistant budget verification. No provider credentials or database details are printed.\n");
  process.exitCode = 1;
} finally {
  if (testRowCreated) await pool.query("DELETE FROM goodwill_assistant_usage WHERE grant_id=$1", [testGrant]).catch(() => { process.exitCode = 1; });
  await pool.end();
}