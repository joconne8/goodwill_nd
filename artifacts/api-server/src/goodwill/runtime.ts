import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Router, type Request } from "express";
import { pool } from "@workspace/db";
import { goodwillStorage, goodwillBrowser } from "../lib/goodwillAdapters";
import { approvedReplicaUrl } from "./replicaDestination";
import {
  AcquisitionService, BrowserReplay, PostgresRunRepository, createAcquisitionRouter,
} from "./acquisition";
import {
  PrivateArchive, PostgresRepository, IntakeService, ReportingService,
  createDataRouter, loadApprovedControls, signPrivateUpload,
} from "./data";

export type OperatorAuthorizer = (request: Request) => Promise<string | null>;

/** One supervised worker, permanent PostgreSQL metadata and private exact bytes. */
export async function createGoodwillRuntime(authorizeOperator: OperatorAuthorizer) {
  const fixtureRoot = process.env.GOODWILL_FIXTURE_ROOT ??
    path.resolve(process.cwd(), "../../docs/goodwill/evidence/github/goodwill/synthetic-data");
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("Private App Storage must be provisioned before starting v2.");
  const replicaUrl = approvedReplicaUrl;
  const executablePath = process.env.GOODWILL_CHROMIUM_EXECUTABLE_PATH ??
    execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  const archive = new PrivateArchive(goodwillStorage, privateDir, signPrivateUpload);
  const controls = await loadApprovedControls(fixtureRoot); // metadata, NEVER startup seed
  const repository = new PostgresRepository(pool);
  const replay = new BrowserReplay({
    launcher: goodwillBrowser(executablePath),
    replicaUrl, allowedOrigin: new URL(replicaUrl).origin,
  });
  const acquisition = new AcquisitionService({
    repository: new PostgresRunRepository(pool), archive, replay,
    fixture: await readFile(path.join(fixtureRoot, "02_upright_paid_order_items_aug2026.csv"), "utf8"),
  });
  const intake = new IntakeService({
    repository, archive, controls,
    resolveVerifiedRun: id => acquisition.resolveVerifiedRun(id),
  });
  const reporting = new ReportingService(repository, controls);
  await acquisition.initialize();
  await intake.initialize();
  const router = Router();
  // Both routers share mandatory server authorization. Never infer it from persona.
  router.use(async (req, res, next) => {
    try {
      if (!await authorizeOperator(req)) {
        res.status(401).json({
          code: "OPERATOR_AUTH_REQUIRED",
          message: "Sign in with an explicitly approved operator account. Persona labels do not authorize access.",
          retainedPrevious: true,
        });
        return;
      }
      next();
    } catch {
      res.status(503).json({ code: "AUTH_UNAVAILABLE", message: "Operator authorization is unavailable.", retainedPrevious: true });
    }
  });
  router.use(createAcquisitionRouter(acquisition));
  router.use(createDataRouter(intake, reporting, authorizeOperator));
  return { router, acquisition, intake, reporting, archive, repository, fixtureRoot };
}