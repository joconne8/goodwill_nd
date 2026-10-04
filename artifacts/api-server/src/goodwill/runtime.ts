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
import { GoodwillAssistantService, GoodwillOverviewService, createAssistantRouter } from "./assistant";
import { AnalyticsService } from "./analytics/service";
import { createAnalyticsRouter } from "./analytics/router";
import { createExperimentalAcquisitionRouter, createLocalSyntheticReplica, PostgresExperimentMetadataStore } from "./acquisition/experimental";
import { SyntheticOpenAIProvider } from "./assistant/provider";
import { PostgresAssistantUsage } from "./assistant/usage";

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
  const localReplica = await createLocalSyntheticReplica({
    launcher: goodwillBrowser(executablePath),
    fixture: await readFile(path.join(fixtureRoot, "02_upright_paid_order_items_aug2026.csv"), "utf8"),
  });
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
  router.use(createAnalyticsRouter(new AnalyticsService(repository, reporting), authorizeOperator));
  router.use(createExperimentalAcquisitionRouter({
    acquisition, store: new PostgresExperimentMetadataStore(pool),
    authorizeOperator, source: localReplica.source,
    // The same explicitly approved synthetic operators may manually review
    // recipes; this is not permission to spend on model execution.
    authorizeReview: async (_request, operatorId) => Boolean(operatorId),
    // No discovery dependency: prior paid-call authorization was consumed.
  }));
  router.use(createAssistantRouter(
    new GoodwillAssistantService(reporting, new SyntheticOpenAIProvider(
      new PostgresAssistantUsage(pool),
      {
        baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        // This is a development-only, finite synthetic approval, not production
        // permission. A server flag is necessary but never replaces the ledger.
        enabled: process.env.NODE_ENV === "development" &&
          process.env.GOODWILL_SYNTHETIC_ASSISTANT_ENABLED === "true",
      },
    )),
    new GoodwillOverviewService(pool, repository, reporting),
    authorizeOperator,
  ));
  return { router, acquisition, intake, reporting, archive, repository, fixtureRoot, close: () => localReplica.close() };
}
