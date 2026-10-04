import { Router, type Request, type Response } from "express";
import { ReportError, validatePeriod } from "../../../lib/goodwill";
import { AcquisitionError } from "../contracts";
import type { AcquisitionService } from "../service";
import { digest, POLICY_VERSION } from "./policy";
import { ApprovedRecipeReplay, ExperimentalDiscoveryReplay, type ExperimentalOptions } from "./replay";
import { assertRecipe, RecipeReview, type MetadataStore, type Recipe } from "./review";
import { assertGates, type DecisionProvider, type ExperimentGates } from "./provider";

export interface AuthorizedDiscoveryExecution {
  provider: DecisionProvider;
  gates: ExperimentGates;
  /** Read-only grant inspection. MUST NOT spend, reserve, read credentials or
   * call the provider. SCRIPTED test grants are not Jev spending permission. */
  authorizationStatus(request: Request, operatorId: string): Promise<{ authorized: boolean; explanation: string }>;
  /** Atomically verify and reserve a NEW explicit bounded run authorization.
   * Failure/attempt consumes its reservation; never reuse the spent smoke grant.
   * This trusted adapter owns account-wide spending/expiry/concurrency limits. */
  authorizeExecution(request: Request, operatorId: string, budget: {
    maxCalls: number; maxInputTokens: number; callTimeoutMs: number;
  }): Promise<boolean>;
  maxCalls?: number;
  maxInputTokens?: number;
  callTimeoutMs?: number;
}

export interface ExperimentalAcquisitionRouterOptions {
  /** SAME initialized acquisition worker as /runs and common intake. */
  acquisition: AcquisitionService;
  store: MetadataStore;
  /** Existing exact-operator authorizer, never a client role or persona. */
  authorizeOperator(request: Request): Promise<string | null>;
  /** Explicit server-owned process-owner entitlement; absent means review denied. */
  authorizeReview?: (request: Request, operatorId: string) => Promise<boolean>;
  /** Approved local synthetic source configuration, not a wire URL.
   * null keeps review readable while replay is unavailable. */
  source: Omit<ExperimentalOptions, "store" | "testFault"> | null;
  /** Absent by default. No environment/key discovery or implicit grant. */
  discovery?: AuthorizedDiscoveryExecution;
}

export interface ExperimentAccess {
  discoveryAuthorized: boolean;
  mode: "review-and-approved-replay" | "review-only";
  explanation: string;
  provider: "JEV_DISABLED" | "JEV" | "SCRIPTED";
  providerConfigured: boolean;
  executionAuthorized: boolean;
  spendingAuthorized: boolean;
  evaluatedThresholdsConfigured: boolean;
  syntheticPayloadApproved: boolean;
  providerAccessApproved: boolean;
  sourceConfigured: boolean;
  sourceMode: "local-synthetic-replica" | "unconfigured";
  approvalAuthorized: boolean;
  approvedRecipeCount: number;
  replayAvailable: boolean;
  policyVersion: string;
}

/** Mount under the existing exact-operator middleware at /api/goodwill/v2.
 * Defense in depth repeats that SAME authorizer; it does not create another
 * identity system. Runtime must omit discovery until SEPARATE execution and
 * spending approval is supplied through an explicit trusted bounded adapter. */
export function createExperimentalAcquisitionRouter(options: ExperimentalAcquisitionRouterOptions): Router {
  const router = Router();
  const review = new RecipeReview(options.store, id => options.acquisition.resolveVerifiedRun(id));
  const sourceConfigured = validSource(options.source);
  const discovery = options.discovery;
  const budget = boundedBudget(discovery);
  const route = (fn: (req: Request, res: Response, operatorId: string) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        let operatorId: string | null;
        try { operatorId = await options.authorizeOperator(req); }
        catch {
          throw new AcquisitionError("AUTH_UNAVAILABLE", "Operator authorization is unavailable.", false, "Retry after authorization recovers.", 503);
        }
        if (!operatorId) throw new AcquisitionError("OPERATOR_AUTH_REQUIRED",
          "Sign in with an explicitly approved operator account. Persona labels do not authorize access.", false, "Sign in.", 401);
        await fn(req, res, operatorId);
      } catch (e) {
        const error = e instanceof AcquisitionError ? e : e instanceof ReportError
          ? new AcquisitionError(e.code, e.message)
          : new AcquisitionError("EXPERIMENT_UNAVAILABLE", "Experiment metadata or authorization is unavailable. No data has been published.", false, "Check service health or use deterministic acquisition.", 503);
        res.status(error.status).json({ code: error.code, error: error.message, message: error.message, retainedPrevious: true });
      }
    };
  router.get("/experiments", route(async (req, res, operatorId) => {
    const records = await review.list();
    const recipes = records.filter(r => r.id.startsWith("recipe-")).map(record => {
      const recipe = record.value as Recipe;
      assertRecipe(recipe);
      // Provenance comes from persisted successful download evidence, never a
      // UI label or assumption that an unattributed recipe was measured Jev.
      const provenance = records.find(r => r.id.startsWith("download-") && isSuccessfulDownload(r.value, record.id, recipe));
      const kind = (provenance?.value as { kind?: unknown } | undefined)?.kind;
      if (kind !== "jev" && kind !== "scripted")
        throw new AcquisitionError("RECIPE_PROVENANCE_MISSING", "Recipe provider provenance is unavailable.", false, "Review persisted discovery evidence.", 409);
      return { id: record.id, digest: digest(recipe), version: recipe.version, kind,
        label: kind === "scripted" ? "SCRIPTED — not measured Jev" : "Jev discovery",
        checksum: recipe.evidence.checksum, byteSize: recipe.evidence.byteSize,
        period: { startDate: recipe.evidence.startDate, endDate: recipe.evidence.endDate },
        steps: recipe.steps.map(s => ({ goal: s.control.goal, operation: s.control.operation, name: s.control.name })) };
    });
    const approvals = await Promise.all(records.filter(r => r.id.startsWith("approval-")).map(async record => {
      const { recipe, approval } = await review.approved(record.id);
      return { id: record.id, version: recipe.version, recipeId: approval.recipeId, digest: approval.recipeDigest, verifiedRunId: approval.verifiedRunId };
    }));
    const approvalAuthorized = !!options.authorizeReview && await options.authorizeReview(req, operatorId);
    const grant = discovery ? await discovery.authorizationStatus(req, operatorId) : { authorized: false, explanation: "" };
    let gatesValid = false;
    if (discovery) {
      try { assertGates(discovery.gates, discovery.provider); gatesValid = true; }
      catch (e) { if (!(e instanceof AcquisitionError)) throw e; }
    }
    const discoveryAuthorized = sourceConfigured && gatesValid && grant.authorized === true;
    const access: ExperimentAccess = {
      discoveryAuthorized, provider: !discovery ? "JEV_DISABLED" : discovery.provider.kind === "scripted" ? "SCRIPTED" : "JEV",
      providerConfigured: !!discovery, executionAuthorized: grant.authorized === true,
      spendingAuthorized: discovery?.provider.kind === "jev" && discovery.gates.spendingApproved === true && grant.authorized === true,
      evaluatedThresholdsConfigured: gatesValid && discovery?.provider.kind === "jev",
      syntheticPayloadApproved: discovery?.gates.syntheticPayloadApproved === true,
      providerAccessApproved: discovery?.gates.accessApproved === true,
      sourceConfigured, sourceMode: sourceConfigured ? "local-synthetic-replica" : "unconfigured",
      approvalAuthorized, approvedRecipeCount: approvals.length, replayAvailable: sourceConfigured && approvals.length > 0,
      mode: sourceConfigured ? "review-and-approved-replay" : "review-only", policyVersion: POLICY_VERSION,
      explanation: (!discovery
        ? "Actual Jev discovery is disabled: separate execution/spending authorization and evaluated thresholds are not configured; the prior one-call smoke authorization is consumed. No provider calls or credential reads occur. "
        : `${discovery.provider.kind === "scripted" ? "SCRIPTED synthetic execution — NOT measured Jev; no Jev spending grant." : "Explicit server-configured Jev adapter."} Discovery ${discoveryAuthorized ? "available subject to a fresh bounded reservation" : "unavailable: source, policy gates or current execution grant missing"}. ${grant.explanation} `) +
        (sourceConfigured ? "The local synthetic source is configured. " : "The approved local synthetic source is not configured; replay is unavailable. ") +
        (approvals.length ? `${approvals.length} explicitly approved recipe version(s) available; replay makes zero model calls. ` : "No approved recipe exists; nothing is autoapproved. ") +
        (approvalAuthorized ? "This operator can explicitly approve verified recipe versions." : "This operator does not have process-owner review authority."),
    };
    res.json({ recipes, approvals, repairCount: records.filter(r => r.id.startsWith("repair-")).length, access });
  }));
  router.post("/experiments/runs", route(async (req, res, operatorId) => {
    const body = object(req.body);
    exactKeys(body, ["mode", "sourceId", "reportType", "period", "approvalId"]);
    if (!["supervised-discovery", "approved-replay"].includes(String(body.mode))) invalid();
    const request = frozenRequest(body);
    if (body.mode === "supervised-discovery") {
      if (body.approvalId !== undefined) invalid();
      if (!discovery) throw new AcquisitionError("JEV_EXECUTION_NOT_AUTHORIZED",
        "Actual Jev discovery is disabled. The prior one-call smoke authorization is consumed; obtain separate execution/spending authorization and evaluated thresholds.", false,
        "Use deterministic acquisition or an explicitly approved model-free recipe.", 403);
      if (!sourceConfigured || !options.source) throw new AcquisitionError("EXPERIMENT_SOURCE_UNCONFIGURED",
        "An approved local synthetic source must be configured before discovery.", false, "Configure the reviewed loopback source.", 409);
      assertGates(discovery.gates, discovery.provider);
      if (!await discovery.authorizeExecution(req, operatorId, budget))
        throw new AcquisitionError("EXPERIMENT_EXECUTION_NOT_AUTHORIZED", "A fresh explicit bounded execution authorization is required.", false, "Obtain separate execution/spending authorization.", 403);
      const replay = new ExperimentalDiscoveryReplay({ ...options.source, store: options.store, review,
        provider: discovery.provider, gates: discovery.gates, ...budget });
      const run = await options.acquisition.start(request, replay);
      res.status(202).json({ id: run.id });
      return;
    }
    if (typeof body.approvalId !== "string") invalid();
    await review.approved(body.approvalId);
    if (!sourceConfigured || !options.source) throw new AcquisitionError("EXPERIMENT_SOURCE_UNCONFIGURED",
      "An approved local synthetic source must be configured before recipe replay.", false, "Use deterministic acquisition.", 409);
    const replay = new ApprovedRecipeReplay({ ...options.source, store: options.store, approvalId: body.approvalId, review });
    const run = await options.acquisition.start(request, replay);
    res.status(202).json({ id: run.id });
  }));
  router.post("/experiments/approvals", route(async (req, res, operatorId) => {
    if (!options.authorizeReview || !await options.authorizeReview(req, operatorId))
      throw new AcquisitionError("PROCESS_OWNER_REQUIRED", "Explicit process-owner review authority is required.", false, "Ask an authorized process owner to review this exact version.", 403);
    const body = object(req.body);
    exactKeys(body, ["recipeId", "expectedDigest", "digest", "verifiedRunId", "confirmation"]);
    if (body.expectedDigest !== undefined && body.digest !== undefined) invalid();
    const expectedDigest = body.expectedDigest ?? body.digest;
    if (typeof body.recipeId !== "string" || typeof body.verifiedRunId !== "string" ||
        typeof expectedDigest !== "string" || !/^[a-f0-9]{64}$/.test(expectedDigest) || body.confirmation !== true) invalid();
    const id = await review.approve({ recipeId: body.recipeId, expectedDigest,
      verifiedRunId: body.verifiedRunId, confirmation: true, reviewerRole: "process-owner" });
    res.status(201).json({ id });
  }));
  return router;
}

function invalid(): never { throw new AcquisitionError("INVALID_EXPERIMENT_REQUEST", "Use only the frozen experiment request fields and an explicit review confirmation."); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) invalid();
}
function frozenRequest(body: Record<string, unknown>) {
  if (body.sourceId !== "upright" || body.reportType !== "paid_order_items") invalid();
  const period = object(body.period);
  exactKeys(period, ["startDate", "endDate"]);
  if (typeof period.startDate !== "string" || typeof period.endDate !== "string") invalid();
  const request = { sourceId: "upright" as const, reportType: "paid_order_items" as const,
    period: { startDate: period.startDate, endDate: period.endDate }, scenario: "success" as const };
  validatePeriod(request.period);
  return request;
}
function validSource(source: ExperimentalAcquisitionRouterOptions["source"]): boolean {
  if (!source) return false;
  try {
    const url = new URL(source.replicaUrl);
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.origin === source.allowedOrigin &&
      !url.username && !url.password && !url.search && !url.hash && !!source.fixture && !!source.launcher &&
      (source.allowedAssetPaths ?? ["/app.js"]).every(asset => /^\/[a-zA-Z0-9_./-]{1,200}\.(js|mjs|css|woff2)$/.test(asset) && !asset.includes(".."));
  } catch { return false; }
}
function isSuccessfulDownload(value: unknown, recipeId: string, recipe: Recipe) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.recipeId === recipeId && record.experimentId === recipe.experimentId &&
    record.actualDownload === true && record.byteVerified === true &&
    record.checksum === recipe.evidence.checksum && record.byteSize === recipe.evidence.byteSize;
}
function boundedBudget(discovery?: AuthorizedDiscoveryExecution) {
  const limits = { maxCalls: discovery?.maxCalls ?? 10, maxInputTokens: discovery?.maxInputTokens ?? 60000,
    callTimeoutMs: discovery?.callTimeoutMs ?? 1200 };
  if (!Number.isSafeInteger(limits.maxCalls) || limits.maxCalls < 1 || limits.maxCalls > 10 ||
      !Number.isSafeInteger(limits.maxInputTokens) || limits.maxInputTokens < 1 || limits.maxInputTokens > 60000 ||
      !Number.isSafeInteger(limits.callTimeoutMs) || limits.callTimeoutMs < 1 || limits.callTimeoutMs > 1200)
    throw new AcquisitionError("INVALID_EXPERIMENT_BUDGET", "Server discovery bounds must fit the reviewed policy caps.");
  return Object.freeze(limits);
}