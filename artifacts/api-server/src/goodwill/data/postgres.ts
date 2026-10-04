import { DataError, type Repository, type Table, type Tx } from "./types";
import { isDeepStrictEqual } from "node:util";
export const tables: Table[] = ["batches","rows","records","publications","uploads","artifacts","audit","heads"];
export interface Connection {
  query(text: string, values?: unknown[]): Promise<{rows: Record<string, unknown>[] }>;
  release(): void;
}
export interface Pool { connect(): Promise<Connection> }
/** Lead applies the reviewed migration. No runtime DDL or memory fallback. */
export class PostgresRepository implements Repository {
  constructor(private pool: Pool) {}
  async transaction<T>(work: (tx: Tx) => Promise<T>) {
    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      // Serialize publish/review/ticket consumption across processes, not just one JS worker.
      await connection.query("SELECT pg_advisory_xact_lock(hashtext('goodwill-data-v2'))");
      const name = (table: Table) => {
        if (!tables.includes(table)) throw new DataError("INVALID_TABLE", "Unknown internal metadata table.");
        return `goodwill_v2_${table}`;
      };
      const tx: Tx = {
        async get<T>(table: Table, id: string) {
          const result = await connection.query(`SELECT document FROM ${name(table)} WHERE id=$1`, [id]);
          return (result.rows[0]?.document as T) ?? null;
        },
        async list<T>(table: Table) {
          const result = await connection.query(`SELECT document FROM ${name(table)} ORDER BY id`);
          return result.rows.map(r => r.document as T);
        },
        async put(table, id, document) {
          // Immutable records, raw metadata and publication snapshots cannot be overwritten.
          const immutable = ["records","publications","artifacts","audit"].includes(table);
          const result = await connection.query(`INSERT INTO ${name(table)} (id,document) VALUES ($1,$2::jsonb)
            ON CONFLICT(id) DO ${immutable ? "NOTHING" : "UPDATE SET document=EXCLUDED.document"} RETURNING id`, [id, JSON.stringify(document)]);
          if (immutable && !result.rows.length) {
            const existing = await tx.get(table, id);
            if (!isDeepStrictEqual(existing, JSON.parse(JSON.stringify(document))))
              throw new DataError("IMMUTABLE_ID_CONFLICT", "Immutable evidence cannot be replaced.", 409);
          }
        },
      };
      const result = await work(tx); await connection.query("COMMIT"); return result;
    } catch (e) { await connection.query("ROLLBACK"); throw e; }
    finally { connection.release(); }
  }
}