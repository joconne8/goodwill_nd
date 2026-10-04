import { randomUUID } from "node:crypto";
import type { Pool } from "../../data/postgres";
import { AcquisitionError } from "../contracts";
import type { MetadataStore } from "./review";

const namespace = "synthetic-acquisition-experiment-v1";
const prefix = "acquisition-experiment-v1:";
const validId = /^(decision|recipe|approval|repair|download)-[a-f0-9-]{36}$/;

/** Append-only, namespaced metadata in the already-migrated audit table. No DDL,
 * raw downloads, model credentials, or fallback in-memory production storage. */
export class PostgresExperimentMetadataStore implements MetadataStore {
  constructor(private pool: Pool) {}
  async append(kind: Parameters<MetadataStore["append"]>[0], value: unknown) {
    if (!["decision", "recipe", "approval", "repair", "download"].includes(kind))
      throw new AcquisitionError("INVALID_REVIEW_ID", "Unknown experiment record kind.");
    const id = `${kind}-${randomUUID()}`;
    const connection = await this.pool.connect();
    try {
      await connection.query("INSERT INTO goodwill_v2_audit (id,document) VALUES ($1,$2::jsonb)",
        [prefix + id, JSON.stringify({ namespace, kind, value })]);
      return id;
    } finally { connection.release(); }
  }
  async read(id: string) {
    if (!validId.test(id)) throw new AcquisitionError("INVALID_REVIEW_ID", "Invalid experiment review identity.");
    const connection = await this.pool.connect();
    try {
      const result = await connection.query("SELECT document FROM goodwill_v2_audit WHERE id=$1", [prefix + id]);
      const document = result.rows[0]?.document as { namespace?: string; kind?: string; value?: unknown } | undefined;
      if (!document || document.namespace !== namespace || document.kind !== id.split("-")[0])
        throw new AcquisitionError("REVIEW_NOT_FOUND", "Experiment review record was not found.", false, "Refresh experiment review.", 404);
      return structuredClone(document.value);
    } finally { connection.release(); }
  }
  async list() {
    const connection = await this.pool.connect();
    try {
      const result = await connection.query(
        "SELECT id,document FROM goodwill_v2_audit WHERE id LIKE $1 ORDER BY id", [prefix + "%"]);
      return result.rows.map(row => {
        const id = String(row.id).slice(prefix.length);
        const document = row.document as { namespace?: string; kind?: string; value?: unknown };
        if (!validId.test(id) || document.namespace !== namespace || document.kind !== id.split("-")[0])
          throw new AcquisitionError("REVIEW_METADATA_INVALID", "Experiment metadata integrity check failed.", false, "Review private metadata storage.", 503);
        return { id, value: structuredClone(document.value) };
      });
    } finally { connection.release(); }
  }
}