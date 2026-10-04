import { randomUUID } from "node:crypto";
import { BrowserReplay, type BrowserLauncher } from "../browser";
import { AcquisitionError, aborted, type Replay, type Request, type Step } from "../contracts";
import { verifyDownload } from "../verify";
import { validatePeriod } from "../../../lib/goodwill";
import { DiscoveryControls } from "./discovery";
import type { DecisionProvider, ExperimentGates } from "./provider";
import { ApprovedRecipeControls, type MetadataStore, type Recipe, type RecipeReview } from "./review";
import { POLICY_VERSION, stop } from "./policy";

export interface ExperimentalOptions {
  launcher: BrowserLauncher; replicaUrl: string; allowedOrigin: string; fixture: string; store: MetadataStore;
  /** Exact GET-only asset paths reviewed by lead; no arbitrary URL or prefix grants. */
  allowedAssetPaths?: readonly string[];
  /** Test-harness fault only; not part of the frozen run request or a public API. */
  testFault?: "wrong_dates" | "failed_download";
}
/** No production registration. Lead explicitly injects this Replay into the SAME acquisition service. */
export class ExperimentalDiscoveryReplay implements Replay {
  constructor(private options: ExperimentalOptions & {
    provider: DecisionProvider; gates: ExperimentGates; review: RecipeReview;
    maxCalls?: number; maxInputTokens?: number; callTimeoutMs?: number;
    parentApprovalId?: string;
  }) {}
  async acquire(request: Request, signal: AbortSignal, step: Step) {
    // The experiment is local-only even if baseline's configured origin is broader.
    assertLocal(this.options);
    validatePeriod(request.period);
    if (request.sourceId !== "upright" || request.reportType !== "paid_order_items") stop("INVALID_REPORT_IDENTITY");
    const experimentId = randomUUID();
    if (this.options.parentApprovalId) await this.options.review.approved(this.options.parentApprovalId);
    const controls = new DiscoveryControls({ ...this.options,
      record: async record => { await this.options.store.append("decision", { experimentId, ...record }); } });
    const browser = new BrowserReplay({ ...this.options, controls, allowRequest: replicaNetworkPolicy(this.options) });
    let actualDownload = false;
    try {
      const evidence = await browser.acquire(request, signal, step);
      actualDownload = true;
      aborted(signal);
      // SAME frozen verifier; no second parser, calculations, publication, or fixture fallback.
      const manifest = verifyDownload(request, evidence, this.options.fixture);
      const recipe: Recipe = {
        schemaVersion: "synthetic-recipe-1", policyVersion: POLICY_VERSION, sourceId: "upright",
        reportType: "paid_order_items", synthetic: true, experimentId, version: randomUUID(), parentApprovalId: this.options.parentApprovalId ?? null,
        parameters: ["startDate", "endDate"], steps: structuredClone(controls.trace),
        completion: ["actual_browser_download", "existing_exact_byte_verifier", "verified_run_archive_identity"],
        evidence: { checksum: manifest.checksum, byteSize: manifest.byteSize, ...request.period },
      };
      const recipeId = await this.options.review.propose(recipe);
      await this.options.store.append("download", { experimentId, kind: this.options.provider.kind,
        actualDownload: true, byteVerified: true, checksum: manifest.checksum, byteSize: manifest.byteSize,
        recipeId, state: "pending_human_review_and_verified_run_binding", calls: controls.calls, inputTokens: controls.inputTokens });
      aborted(signal);
      return evidence; // service verifies/archives and resolves the original bytes/run ID unchanged.
    } catch (e) {
      await this.options.store.append("download", { experimentId, kind: this.options.provider.kind, actualDownload,
        byteVerified: false, calls: controls.calls, inputTokens: controls.inputTokens,
        stopCode: e instanceof AcquisitionError ? e.code : "EXPERIMENT_FAILED" });
      throw e;
    }
  }
}
function assertLocal(options: ExperimentalOptions) {
  const url = new URL(options.replicaUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.origin !== options.allowedOrigin) stop("SYNTHETIC_LOCAL_ONLY");
}
function replicaNetworkPolicy(options: ExperimentalOptions) {
  const replica = new URL(options.replicaUrl).pathname;
  const assets = new Set(options.allowedAssetPaths ?? ["/app.js"]);
  for (const asset of assets) if (!/^\/[a-zA-Z0-9_./-]{1,200}\.(js|mjs|css|woff2)$/.test(asset) || asset.includes("..")) stop("UNSAFE_RESOURCE_POLICY");
  return (url: URL, method: string) => !url.username && !url.password &&
    ((method === "GET" && (url.pathname === replica || assets.has(url.pathname))) ||
      (method === "POST" && url.pathname === "/api/goodwill/report" && !url.search));
}
export class ApprovedRecipeReplay implements Replay {
  constructor(private options: ExperimentalOptions & { approvalId: string; review: RecipeReview }) {}
  async acquire(request: Request, signal: AbortSignal, step: Step) {
    assertLocal(this.options); validatePeriod(request.period);
    const { recipe } = await this.options.review.approved(this.options.approvalId);
    if (request.sourceId !== recipe.sourceId || request.reportType !== recipe.reportType) stop("INVALID_REPORT_IDENTITY");
    const controls = new ApprovedRecipeControls(recipe, this.options.approvalId, this.options.store);
    return new BrowserReplay({ ...this.options, controls, allowRequest: replicaNetworkPolicy(this.options) }).acquire(request, signal, step);
  }
}