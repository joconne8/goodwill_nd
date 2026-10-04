import type { ImportBatch, RawArtifact, MetricQuery, WorkflowFailure } from "@workspace/api-zod";
export type Artifact = Omit<RawArtifact, "archivedAt"> & { archivedAt: string };
export type Batch = Omit<ImportBatch, "receivedAt" | "publishedAt" | "artifact"> & {
  receivedAt: string; publishedAt: string | null; artifact: Artifact | null;
  datasetId: string; coverageComplete: boolean;
};
export type Query = Omit<MetricQuery, "snapshotAt"> & { snapshotAt?: string };
export type Values = Record<string, string | number | boolean | null>;
export type Role = "sales" | "statement" | "expense" | "dimension" | "listing" | "snapshot" | "catalog" | "exception" | "lifecycle";
export interface Dataset {
  id: string; sourceId: string; reportType: string; filename: string; role: Role;
  header: string[]; keyFields: string[]; monetaryFields: string[]; timeBasis: string;
  gross?: string; refund?: string; net?: string; plus?: string[]; minus?: string[];
  date?: string; buyer?: string; supportedMetrics: string[];
}
export interface LedgerRecord {
  id: string; datasetId: string; key: string; fingerprint: string; role: Role;
  sourceId: string; batchId: string; runId: string | null; artifactId: string; checksum: string; sourceRow: number;
  values: Values; date: string | null; month: string | null; storeId: string | null; buyerId: string | null;
  platform: string | null; category: string | null; netItemMinor: number | null; sourceNetMinor: number | null;
  expenseMinor: number | null; warnings: string[];
}
export interface StagedRow {
  id: string; batchId: string; sourceRow: number; record: LedgerRecord | null; values: Values;
  disposition: "accepted" | "rejected" | "duplicate"; reasons: string[];
}
export interface Publication { id: string; at: string; parentId: string | null; recordIds: string[]; batchIds: string[] }
export interface Upload {
  id: string; owner: string; sourceId: string; reportType: string; filename: string; byteSize: number;
  checksum: string; expiresAt: string; consumedBy: string | null;
}
export type Table = "batches" | "rows" | "records" | "publications" | "uploads" | "artifacts" | "audit" | "heads";
export interface Tx {
  get<T>(table: Table, id: string): Promise<T | null>;
  list<T>(table: Table): Promise<T[]>;
  put<T>(table: Table, id: string, document: T): Promise<void>;
}
export interface Repository { transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> }
export interface Archive {
  put(id: string, bytes: Uint8Array, metadata: { filename: string; checksum: string }): Promise<Artifact>;
  read(id: string): Promise<Uint8Array>;
  signUpload(id: string, expiresAt: string): Promise<string>;
  readUpload(id: string): Promise<Uint8Array>;
}
export interface Controls {
  files: Record<string, { rows: number; sha256: string; datasetId?: string; startDate?: string; endDate?: string }>;
  control_totals: Record<string, Record<string, string>>;
  inventory_controls: Record<string, { total_inventory: number; unlisted_backlog: number }>;
}
export class DataError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
  failure(): WorkflowFailure {
    return { code: this.code, message: this.message, retryable: this.status === 503,
      nextAction: this.status === 503 ? "Restore private storage/database access, then retry." : "Review batch rows and source parameters; no silent repair or publication." };
  }
}