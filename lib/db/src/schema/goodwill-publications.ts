import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Only queryable normalized result/lineage, never raw file bytes.
export const goodwillPublicationsTable = pgTable("goodwill_foundation_publications", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull().unique(),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertGoodwillPublicationSchema = createInsertSchema(goodwillPublicationsTable);
export type InsertGoodwillPublication = z.infer<typeof insertGoodwillPublicationSchema>;
export type GoodwillPublication = typeof goodwillPublicationsTable.$inferSelect;