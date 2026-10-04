import { pgTable, text, jsonb, check, index, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

// Deliberately not registered in the shared barrel until lead reviews/applies migration.
function metadata(name: string) {
  return pgTable(name, {
    id: text("id").primaryKey(),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
  },t=>[
    check(`${name}_document_check`,sql`jsonb_typeof(${t.document})='object'`),
    ...(name==="goodwill_v2_rows" ? [index("goodwill_v2_rows_batch_idx").on(sql`(${t.document}->>'batchId')`)] : []),
    ...(name==="goodwill_v2_records" ? [index("goodwill_v2_records_dataset_key_idx").on(sql`(${t.document}->>'datasetId')`,sql`(${t.document}->>'key')`)] : []),
    ...(name==="goodwill_v2_batches" ? [index("goodwill_v2_batches_received_idx").on(sql`(${t.document}->>'receivedAt') DESC`)] : []),
  ]);
}
export const goodwillV2Batches = metadata("goodwill_v2_batches");
export const goodwillV2Rows = metadata("goodwill_v2_rows");
export const goodwillV2Records = metadata("goodwill_v2_records");
export const goodwillV2Publications = metadata("goodwill_v2_publications");
export const goodwillV2Uploads = metadata("goodwill_v2_uploads");
export const goodwillV2Artifacts = metadata("goodwill_v2_artifacts");
export const goodwillV2Audit = metadata("goodwill_v2_audit");
export const goodwillV2Heads = metadata("goodwill_v2_heads");
export const goodwillAcquisitionRuns = pgTable("goodwill_acquisition_runs", {
  id: text("id").primaryKey(), state: text("state").notNull(),
  retryOf: text("retry_of").unique("goodwill_acquisition_runs_retry_of_key"), document: jsonb("document").$type<Record<string, unknown>>().notNull(),
}, t => [
  foreignKey({columns:[t.retryOf],foreignColumns:[t.id],name:"goodwill_acquisition_runs_retry_of_fkey"}),
  check("goodwill_acquisition_runs_state_check",sql`${t.state} IN ('queued','running','downloaded','verified','failed','cancelled')`),
  check("goodwill_acquisition_runs_document_check",sql`jsonb_typeof(${t.document})='object'`),
  index("goodwill_acquisition_runs_state_idx").on(t.state),
  index("goodwill_acquisition_runs_created_idx").on(sql`(${t.document}->>'createdAt') DESC`,t.id.desc()),
]);
export const insertGoodwillV2Batch = createInsertSchema(goodwillV2Batches);
export const insertGoodwillV2Row = createInsertSchema(goodwillV2Rows);
export const insertGoodwillV2Record = createInsertSchema(goodwillV2Records);
export const insertGoodwillV2Publication = createInsertSchema(goodwillV2Publications);
export const insertGoodwillV2Upload = createInsertSchema(goodwillV2Uploads);
export const insertGoodwillV2Artifact = createInsertSchema(goodwillV2Artifacts);
export const insertGoodwillV2Audit = createInsertSchema(goodwillV2Audit);
export const insertGoodwillV2Head = createInsertSchema(goodwillV2Heads);
export const insertGoodwillAcquisitionRun = createInsertSchema(goodwillAcquisitionRuns);
export type GoodwillV2Batch = z.infer<typeof insertGoodwillV2Batch>;
export type GoodwillV2Row = z.infer<typeof insertGoodwillV2Row>;
export type GoodwillV2Record = z.infer<typeof insertGoodwillV2Record>;
export type GoodwillV2Publication = z.infer<typeof insertGoodwillV2Publication>;