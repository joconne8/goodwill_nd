import { Router, type Request, type Response } from "express";
import { ReportError } from "../../lib/goodwill";
import { AcquisitionError } from "./contracts";
import type { AcquisitionService } from "./service";

/** Lead mounts at /api/goodwill/v2. Never mounts itself or changes legacy routes. */
export function createAcquisitionRouter(service: AcquisitionService) {
  const router = Router();
  const route = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try { await fn(req, res); }
      catch (e) {
        const error = e instanceof AcquisitionError ? e : e instanceof ReportError
          ? new AcquisitionError(e.code, e.message)
          : new AcquisitionError("STORAGE_UNAVAILABLE", "Acquisition storage is unavailable. Published data has not been changed.", true, "Check service health.", 503);
        res.status(error.status).json({ code: error.code, error: error.message });
      }
    };
  router.post("/runs", route(async (req, res) => res.status(202).json(await service.start(req.body))));
  router.get("/runs", route(async (req, res) => {
    const offset = Number(req.query.offset ?? 0), limit = Number(req.query.limit ?? 100);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500)
      throw new AcquisitionError("INVALID_PAGINATION", "Offset must be nonnegative; limit must be 1..500.");
    res.json({ ...await service.list(offset, limit), offset, limit });
  }));
  router.get("/runs/:runId", route(async (req, res) => res.json(await service.get(String(req.params.runId)))));
  router.post("/runs/:runId/cancel", route(async (req, res) => res.json(await service.cancel(String(req.params.runId)))));
  router.get("/runs/:runId/download", route(async (req, res) => {
    const { bytes, artifact } = await service.resolveVerifiedRun(String(req.params.runId));
    // Frozen binary contract: the generated client infers Blob from this MIME type.
    res.setHeader("Content-Type", "application/octet-stream");
    // Filename is revalidated to prevent header injection even with a faulty archive adapter.
    if (!/^synthetic_upright_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(artifact.filename))
      throw new AcquisitionError("INVALID_FILENAME", "Stored artifact filename is invalid.");
    res.setHeader("Content-Disposition", `attachment; filename="${artifact.filename}"`);
    res.setHeader("X-Content-SHA256", artifact.checksum);
    res.setHeader("Content-Length", bytes.length);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(bytes));
  }));
  return router;
}