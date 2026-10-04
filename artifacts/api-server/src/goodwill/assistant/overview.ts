import { GetGoodwillSystemOverviewResponse } from "@workspace/api-zod";
import { datasets } from "../data/catalog";
import { current, recordsFor } from "../data/intake";
import { tables, type Pool } from "../data/postgres";
import { ReportingService } from "../data/reporting";
import { DataError, type Batch, type Publication, type Repository } from "../data/types";

export const businessSources = [
  { sourceId: "cash_monkey", label: "CashMonkey" },
  { sourceId: "upright", label: "Upright" },
  { sourceId: "jewelry", label: "Jewelry" },
  { sourceId: "shipping", label: "Shipping: OSM / Pitney Bowes / EasyPost" },
  { sourceId: "fedex", label: "FedEx" },
  { sourceId: "shopgoodwill", label: "ShopGoodwill" },
  { sourceId: "goodwill_books", label: "Goodwill Books" },
  { sourceId: "ebay", label: "eBay" },
  { sourceId: "amazon", label: "Amazon" },
] as const;
export const overviewTables = [...tables.map(t => `goodwill_v2_${t}`), "goodwill_acquisition_runs", "goodwill_foundation_publications"] as const;

/** The only SQL here is a backend-owned allowlist. No estimates, arbitrary
 * identifiers, credentials, private object paths or missing-table zero fallback. */
export class GoodwillOverviewService {
  constructor(private pool: Pool, private repository: Repository, private reporting: ReportingService) {}
  async get() {
    const connection = await this.pool.connect();
    let counts: { name: string; rowCount: number }[];
    try {
      await connection.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const { rows } = await connection.query(overviewTables.map(name =>
        `SELECT '${name}' AS name, COUNT(*)::text AS "rowCount" FROM ${name}`).join(" UNION ALL "));
      if (rows.length !== overviewTables.length) throw new Error("Incomplete table counts");
      counts = overviewTables.map(name => {
        const row = rows.find(r => r.name === name);
        const raw = row?.rowCount;
        if ((typeof raw !== "string" && typeof raw !== "number") || !/^\d+$/.test(String(raw)))
          throw new Error("Invalid table count");
        const rowCount = Number(raw);
        if (!Number.isSafeInteger(rowCount) || rowCount < 0) throw new Error("Unsafe table count");
        return { name, rowCount };
      });
      await connection.query("COMMIT");
    } catch {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw new DataError("OVERVIEW_UNAVAILABLE", "PostgreSQL table counts could not be verified. No estimated or missing-table counts are returned.", 503);
    } finally { connection.release(); }
    const catalog = await this.reporting.catalog();
    const sources = await this.repository.transaction(async tx => {
      const pub = await current(tx);
      const records = await recordsFor(tx, pub);
      const batches = await tx.list<Batch>("batches");
      const publications = await tx.list<Publication>("publications");
      return businessSources.map(source => {
        const ids = new Set(datasets.filter(d => d.sourceId === source.sourceId && ["sales", "expense", "statement"].includes(d.role)).map(d => d.id));
        const sourceBatches = batches.filter(b => ids.has(b.datasetId) && b.sourceId === source.sourceId);
        const batchIds = new Set(sourceBatches.map(b => b.id));
        const coverage = catalog.datasets.filter(d => ids.has(d.id)).map(d => d.coverage.status);
        const status = ["failed", "missing", "stale", "partial"].find(s => coverage.includes(s as typeof coverage[number])) ?? "complete";
        return {
          ...source, datasetCount: ids.size, batchCount: sourceBatches.length,
          publicationCount: publications.filter(p => p.batchIds.some(id => batchIds.has(id))).length,
          acceptedRows: records.filter(r => ids.has(r.datasetId) && r.sourceId === source.sourceId).length,
          status,
        };
      });
    });
    const result = {
      database: { engine: "PostgreSQL" as const, verifiedAt: new Date().toISOString(), tables: counts },
      sources, storage: { kind: "private_object_storage" as const, originalBytesInDatabase: false as const },
      queryMode: "deterministic_tools" as const,
    };
    GetGoodwillSystemOverviewResponse.parse(result);
    return result;
  }
}