import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** One finite execution grant. Never reset this row on startup or deployment. */
export const goodwillAssistantUsageTable = pgTable("goodwill_assistant_usage", {
  grantId: text("grant_id").primaryKey(),
  attemptedCalls: integer("attempted_calls").notNull().default(0),
  reservedCents: integer("reserved_cents").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
});
export const insertGoodwillAssistantUsageSchema = createInsertSchema(goodwillAssistantUsageTable);
export type InsertGoodwillAssistantUsage = z.infer<typeof insertGoodwillAssistantUsageSchema>;
export type GoodwillAssistantUsage = typeof goodwillAssistantUsageTable.$inferSelect;