import type { Pool } from "../data/postgres";
import { DataError } from "../data/types";

export const syntheticGrantId = "dashboard-synthetic-openai-2026-10-04";
export interface Reservation { attemptedCalls: number; reservedCents: number }
export interface UsageLedger { reserve(): Promise<Reservation> }

/** A $1 pessimistic reservation per attempt, never refunded. PostgreSQL makes
 * the five-attempt/$5 grant shared across workers, restarts and failed calls.
 * No model-facing tool can access this pool or these statements. */
export class PostgresAssistantUsage implements UsageLedger {
  constructor(private pool: Pool, private grantId = syntheticGrantId) {}
  async reserve(): Promise<Reservation> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`INSERT INTO goodwill_assistant_usage (grant_id) VALUES ($1)
        ON CONFLICT (grant_id) DO NOTHING`, [this.grantId]);
      const { rows } = await c.query(`UPDATE goodwill_assistant_usage
        SET attempted_calls=attempted_calls+1, reserved_cents=reserved_cents+100, last_attempt_at=now()
        WHERE grant_id=$1 AND attempted_calls < 5 AND reserved_cents <= 400
        RETURNING attempted_calls, reserved_cents`, [this.grantId]);
      if (rows.length !== 1) throw new DataError("MODEL_LIMIT_REACHED", "The finite synthetic model grant is exhausted. Model-free mode remains available.", 429);
      const attemptedCalls = Number(rows[0].attempted_calls);
      const reservedCents = Number(rows[0].reserved_cents);
      if (!Number.isInteger(attemptedCalls) || attemptedCalls < 1 || attemptedCalls > 5 || reservedCents !== attemptedCalls * 100)
        throw new DataError("MODEL_USAGE_UNAVAILABLE", "Model spending counters could not be verified.", 503);
      await c.query("COMMIT");
      return { attemptedCalls, reservedCents };
    } catch (error) {
      await c.query("ROLLBACK").catch(() => undefined);
      if (error instanceof DataError) throw error;
      throw new DataError("MODEL_USAGE_UNAVAILABLE", "Durable model spending controls are unavailable. No provider request was sent.", 503);
    } finally { c.release(); }
  }
}