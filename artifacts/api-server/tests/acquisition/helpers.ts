import { readFile } from "node:fs/promises";
import { AcquisitionError, type Archive, type Artifact, type Run, type RunRepository, type Request, type Replay } from "../../src/goodwill/acquisition/contracts";
import { generateReport } from "../../src/lib/goodwill";

export const fixture = await readFile("docs/goodwill/evidence/github/goodwill/synthetic-data/02_upright_paid_order_items_aug2026.csv", "utf8");
export const request: Request = { sourceId: "upright", reportType: "paid_order_items",
  period: { startDate: "2026-08-01", endDate: "2026-08-07" }, scenario: "success" };
/** Test doubles only. Runtime requires injected persistent Postgres/private archive adapters. */
export class TestRepository implements RunRepository {
  rows = new Map<string, Run>();
  async create(run: Run) {
    if (this.rows.has(run.id) || (run.request.retryOf &&
        [...this.rows.values()].some(r => r.request.retryOf === run.request.retryOf)))
      throw new AcquisitionError("RETRY_ALREADY_USED", "Retry already reserved.", false, "Inspect the existing retry.", 409);
    this.rows.set(run.id, structuredClone(run));
  }
  async get(id: string) { return structuredClone(this.rows.get(id) ?? null); }
  async list(offset: number, limit: number) {
    const rows = [...this.rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items: structuredClone(rows.slice(offset, offset + limit)), total: rows.length };
  }
  async replace(run: Run, expected: Run["state"][]) {
    const current = this.rows.get(run.id);
    if (!current || !expected.includes(current.state)) return false;
    this.rows.set(run.id, structuredClone(run)); return true;
  }
  async interruptUnfinished(at: string) {
    for (const run of this.rows.values()) if (["queued", "running", "downloaded"].includes(run.state)) {
      run.state = "failed"; run.artifact = null; run.updatedAt = at;
      run.failure = new AcquisitionError("RUN_INTERRUPTED", "Interrupted.", true, "Retry explicitly.").toFailure();
    }
  }
}
export class TestArchive implements Archive {
  objects = new Map<string, Uint8Array>(); calls = 0;
  async put(key: string, bytes: Uint8Array, m: { filename: string; checksum: string }): Promise<Artifact> {
    this.calls++;
    this.objects.set(key, bytes.slice());
    return { ...m, artifactId: key, byteSize: bytes.length, archivedAt: new Date().toISOString(), synthetic: true };
  }
  async read(id: string) { const b = this.objects.get(id); if (!b) throw new Error("Missing object"); return b.slice(); }
}
export const fakeReplay: Replay = { async acquire(req) {
  const report = generateReport(req.period, fixture);
  const bytes = new TextEncoder().encode(report.csv);
  return { bytes, suggestedFilename: report.filename, downloadedAt: new Date().toISOString(),
    manifest: { ...report, timezone: "America/New_York", byteSize: bytes.length } };
} };
export async function waitRun(service: { get(id: string): Promise<Run> }, id: string) {
  for (let i = 0; i < 1500; i++) {
    const r = await service.get(id);
    if (["verified", "failed", "cancelled"].includes(r.state)) return r;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error("Test run did not reach a terminal state.");
}