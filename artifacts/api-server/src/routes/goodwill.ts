import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, goodwillPublicationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { calculateReport, generateReport, ReportError } from "../lib/goodwill";
import fixture from "../../../../docs/goodwill/evidence/github/goodwill/synthetic-data/02_upright_paid_order_items_aug2026.csv";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const errorResponse = (res: import("express").Response, error: unknown) => {
  if (error instanceof ReportError) return res.status(400).json({ code: error.code, error: error.message });
  logger.error({ err: error }, "Goodwill foundation operation failed");
  return res.status(503).json({ code: "STORAGE_UNAVAILABLE", error: "The reporting store is unavailable. Last successfully published data has not been replaced." });
};

router.post("/goodwill/report", (req, res) => {
  try { res.json(generateReport(req.body, fixture)); }
  catch (error) { errorResponse(res, error); }
});
router.post("/goodwill/imports", async (req, res) => {
  try {
    const calculated = calculateReport(req.body);
    if (generateReport(calculated, fixture).checksum !== calculated.checksum)
      throw new ReportError("UNKNOWN_SYNTHETIC_REPORT", "This foundation only publishes the unchanged generated synthetic Upright file. New or corrected source bytes need review.");
    const scope = `${calculated.sourceId}/${calculated.reportType}/${calculated.startDate}/${calculated.endDate}/${calculated.definitionVersion}`;
    // One atomic insert per exact reporting scope. Overlaps are not accumulated.
    const result = { ...calculated, importId: randomUUID(), publishedAt: new Date().toISOString() };
    const [inserted] = await db.insert(goodwillPublicationsTable)
      .values({ id: result.importId, scope, result })
      .onConflictDoNothing({ target: goodwillPublicationsTable.scope }).returning();
    if (inserted) return res.json(inserted.result);
    const [existing] = await db.select().from(goodwillPublicationsTable).where(eq(goodwillPublicationsTable.scope, scope));
    if (!existing) throw new Error("Concurrent publication disappeared.");
    if (existing.result.checksum !== calculated.checksum)
      return res.status(400).json({ code: "CORRECTION_REQUIRES_REVIEW", error: "Different bytes for this reporting scope need human review; the previous publication is retained." });
    // Re-select the immutable publication so the result of every successful import
    // is visible on reload and to other sessions, without making a new metric version.
    await db.update(goodwillPublicationsTable).set({ selectedAt: new Date() })
      .where(eq(goodwillPublicationsTable.scope, scope));
    return res.json(existing.result);
  } catch (error) { return errorResponse(res, error); }
});
router.get("/goodwill/latest", async (_req, res) => {
  try {
    const [latest] = await db.select().from(goodwillPublicationsTable).orderBy(desc(goodwillPublicationsTable.selectedAt)).limit(1);
    res.json({ result: latest?.result ?? null });
  } catch (error) { errorResponse(res, error); }
});
router.get("/goodwill/sources", (_req, res) => res.json([
  { id: "upright", name: "Upright", acquisitionClass: "Browser CSV export", accountingRole: "Item sales; channel overlap requires review", status: "synthetic_fixture" },
  { id: "cash_monkey", name: "Cash Monkey", acquisitionClass: "Browser CSV export", accountingRole: "Book sales", status: "not_connected" },
  { id: "jewelry", name: "Jewelry", acquisitionClass: "Weekly emailed or uploaded report", accountingRole: "Jewelry sales and commissions; supplier unconfirmed", status: "not_connected" },
  { id: "shipping", name: "OSM / Pitney Bowes / EasyPost", acquisitionClass: "Carrier report or delivered file", accountingRole: "Shipping expense, not revenue", status: "not_connected" },
  { id: "fedex", name: "FedEx", acquisitionClass: "Weekly invoice / credit", accountingRole: "Shipping charges and refunds, not revenue", status: "not_connected" },
  { id: "shopgoodwill", name: "ShopGoodwill", acquisitionClass: "Browser periodic report", accountingRole: "Marketplace sales; potential Upright overlap", status: "not_connected" },
  { id: "goodwill_books", name: "Goodwill Books", acquisitionClass: "Monthly payment statement", accountingRole: "Book settlement; not necessarily incremental sales", status: "not_connected" },
  { id: "ebay", name: "eBay", acquisitionClass: "Browser listing/sales report", accountingRole: "Marketplace sales; potential Upright overlap", status: "not_connected" },
  { id: "amazon", name: "Amazon", acquisitionClass: "Browser payments summary", accountingRole: "Posted financial activity / settlement, not buyer counts", status: "not_connected" },
]));
export default router;