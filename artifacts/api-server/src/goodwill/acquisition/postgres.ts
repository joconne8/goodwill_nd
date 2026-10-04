import { AcquisitionError, type Run, type RunRepository } from "./contracts";

export interface SqlClient {
  query<T>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
/** No implicit DDL, database fallback, CSV persistence or migration on startup. */
export class PostgresRunRepository implements RunRepository {
  constructor(private sql: SqlClient) {}
  async create(run: Run) {
    try {
      await this.sql.query(
        "INSERT INTO goodwill_acquisition_runs (id,state,retry_of,document) VALUES ($1,$2,$3,$4::jsonb)",
        [run.id, run.state, run.request.retryOf ?? null, JSON.stringify(run)]);
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new AcquisitionError("RETRY_ALREADY_USED", "This run already has its one explicit retry.", false, "Inspect the existing retry.", 409);
      throw e;
    }
  }
  async get(id: string) {
    const { rows } = await this.sql.query<{ document: Run }>("SELECT document FROM goodwill_acquisition_runs WHERE id=$1", [id]);
    return rows[0]?.document ?? null;
  }
  async list(offset: number, limit: number) {
    const { rows } = await this.sql.query<{ document: Run }>(
      "SELECT document FROM goodwill_acquisition_runs ORDER BY document->>'createdAt' DESC,id DESC OFFSET $1 LIMIT $2", [offset, limit]);
    const count = await this.sql.query<{ total: string }>("SELECT count(*) AS total FROM goodwill_acquisition_runs");
    return { items: rows.map(r => r.document), total: Number(count.rows[0].total) };
  }
  async replace(run: Run, expected: Run["state"][]) {
    const { rows } = await this.sql.query<{ id: string }>(
      "UPDATE goodwill_acquisition_runs SET state=$2,document=$3::jsonb WHERE id=$1 AND state=ANY($4::text[]) RETURNING id",
      [run.id, run.state, JSON.stringify(run), expected]);
    return rows.length === 1;
  }
  async interruptUnfinished(at: string) {
    const failure = {
      code: "RUN_INTERRUPTED", message: "The acquisition process stopped before verification.",
      retryable: true, nextAction: "Review the last completed step, then explicitly retry or upload the CSV manually.",
    };
    await this.sql.query(
      `UPDATE goodwill_acquisition_runs SET state='failed',document=document ||
       jsonb_build_object('state','failed','updatedAt',$1::text,'artifact',NULL,'failure',$2::jsonb)
       WHERE state IN ('queued','running','downloaded')`, [at, JSON.stringify(failure)]);
  }
}