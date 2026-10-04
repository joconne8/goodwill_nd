import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserControls, Page } from "../browser";
import type { Request, Step } from "../contracts";
import { act, digest, eligible, GOALS, observe, POLICY_VERSION, semantic, sameSemantic, stateDigest, stop, validSemantic } from "./policy";
import type { TraceStep } from "./discovery";

export interface MetadataStore {
  append(kind: "decision" | "recipe" | "approval" | "repair" | "download", value: unknown): Promise<string>;
  read(id: string): Promise<unknown>;
  list(): Promise<{ id: string; value: unknown }[]>;
}
/** Immutable PRIVATE experiment metadata, not CSV storage or a financial DB. Lead supplies directory. */
export class FileMetadataStore implements MetadataStore {
  constructor(private directory: string) {
    if (!path.isAbsolute(directory)) stop("PRIVATE_REVIEW_DIRECTORY_REQUIRED");
  }
  async append(kind: Parameters<MetadataStore["append"]>[0], value: unknown) {
    const id = `${kind}-${randomUUID()}`;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(this.directory, `${id}.json`), JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
    return id;
  }
  async read(id: string) {
    if (!/^(decision|recipe|approval|repair|download)-[a-f0-9-]{36}$/.test(id)) stop("INVALID_REVIEW_ID");
    return JSON.parse(await readFile(path.join(this.directory, `${id}.json`), "utf8"));
  }
  async list() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const ids = (await readdir(this.directory)).filter(n => /^(decision|recipe|approval|repair|download)-[a-f0-9-]{36}\.json$/.test(n)).sort();
    return Promise.all(ids.map(async n => ({ id: n.slice(0, -5), value: await this.read(n.slice(0, -5)) })));
  }
}
export interface Recipe {
  schemaVersion: "synthetic-recipe-1";
  policyVersion: typeof POLICY_VERSION;
  sourceId: "upright"; reportType: "paid_order_items"; synthetic: true;
  experimentId: string; version: string; parentApprovalId: string | null;
  parameters: readonly ["startDate", "endDate"];
  steps: TraceStep[];
  completion: readonly ["actual_browser_download", "existing_exact_byte_verifier", "verified_run_archive_identity"];
  evidence: { checksum: string; byteSize: number; startDate: string; endDate: string };
}
export interface Approval {
  approved: true; recipeId: string; recipeDigest: string; policyVersion: string;
  reviewedAt: string; reviewerRole: "process-owner";
  verifiedRunId: string; artifactId: string; checksum: string;
}
export type ResolvedRun = {
  run: { id: string; state: string; request: Request };
  bytes: Uint8Array;
  artifact: { artifactId: string; checksum: string; byteSize: number };
};
export function assertRecipe(recipe: Recipe) {
  if (!recipe || recipe.schemaVersion !== "synthetic-recipe-1" || recipe.policyVersion !== POLICY_VERSION ||
      recipe.sourceId !== "upright" || recipe.reportType !== "paid_order_items" || recipe.synthetic !== true ||
      recipe.steps?.length !== GOALS.length || digest(recipe.parameters) !== digest(["startDate", "endDate"]) ||
      digest(recipe.completion) !== digest(["actual_browser_download", "existing_exact_byte_verifier", "verified_run_archive_identity"]) ||
      !recipe.evidence || !/^[a-f0-9]{64}$/.test(recipe.evidence.checksum)) stop("INVALID_RECIPE");
  for (let i = 0; i < GOALS.length; i++) {
    const c = recipe.steps[i]?.control;
    if (!c || c.goal !== GOALS[i] || !validSemantic(c) ||
        !/^[a-f0-9]{64}$/.test(recipe.steps[i].beforeDigest) || !/^[a-f0-9]{64}$/.test(recipe.steps[i].afterDigest) ||
        !/^[a-f0-9]{64}$/.test(recipe.steps[i].expectedStateDigest)) stop("INVALID_RECIPE");
  }
}
/** Internal authorized review boundary, NOT an unauthenticated route. */
export class RecipeReview {
  constructor(private store: MetadataStore, private resolve: (runId: string) => Promise<ResolvedRun>) {}
  async propose(recipe: Recipe) {
    assertRecipe(recipe);
    if (recipe.parentApprovalId) await this.approved(recipe.parentApprovalId);
    return this.store.append("recipe", structuredClone(recipe));
  }
  list() { return this.store.list(); }
  async approve(input: { recipeId: string; expectedDigest: string; verifiedRunId: string;
    confirmation: boolean; reviewerRole: "process-owner" }) {
    if (input.confirmation !== true || input.reviewerRole !== "process-owner") stop("EXPLICIT_REVIEW_REQUIRED");
    if (!input.recipeId.startsWith("recipe-")) stop("INVALID_RECIPE");
    const recipe = await this.store.read(input.recipeId) as Recipe;
    assertRecipe(recipe);
    if (digest(recipe) !== input.expectedDigest) stop("REVIEW_VERSION_CHANGED");
    const verified = await this.resolve(input.verifiedRunId);
    const e = recipe.evidence;
    if (verified.run.state !== "verified" || verified.run.id !== input.verifiedRunId ||
        verified.run.request.sourceId !== recipe.sourceId || verified.run.request.reportType !== recipe.reportType ||
        verified.run.request.period.startDate !== e.startDate || verified.run.request.period.endDate !== e.endDate ||
        verified.artifact.checksum !== e.checksum || verified.artifact.byteSize !== e.byteSize ||
        verified.bytes.length !== e.byteSize || digestBytes(verified.bytes) !== e.checksum) stop("RECIPE_RUN_IDENTITY_MISMATCH");
    return this.store.append("approval", {
      approved: true, recipeId: input.recipeId, recipeDigest: input.expectedDigest, policyVersion: POLICY_VERSION,
      reviewedAt: new Date().toISOString(), reviewerRole: input.reviewerRole,
      verifiedRunId: verified.run.id, artifactId: verified.artifact.artifactId, checksum: e.checksum,
    } satisfies Approval);
  }
  async approved(id: string) {
    if (!id.startsWith("approval-")) stop("UNAPPROVED_RECIPE");
    const approval = await this.store.read(id) as Approval;
    if (!approval || approval.approved !== true || approval.policyVersion !== POLICY_VERSION) stop("UNAPPROVED_RECIPE");
    const recipe = await this.store.read(approval.recipeId) as Recipe;
    assertRecipe(recipe);
    if (digest(recipe) !== approval.recipeDigest) stop("REVIEW_VERSION_CHANGED");
    return { approval, recipe };
  }
}
const digestBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** No decision provider dependency at all. A new instance is created per run. */
export class ApprovedRecipeControls implements BrowserControls {
  private phase = 0;
  constructor(private recipe: Recipe, private approvalId: string, private store: MetadataStore) { assertRecipe(recipe); }
  async prepare(page: Page, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    for (let i = 0; i < GOALS.length - 1; i++) await this.execute(page, request, signal, step, deadline);
  }
  async download(page: Page, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    if (this.phase !== GOALS.length - 1) stop("INVALID_TRANSITION");
    await this.execute(page, request, signal, step, deadline);
  }
  private async execute(page: Page, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    const expected = this.recipe.steps[this.phase]?.control;
    if (!expected) stop("INVALID_TRANSITION");
    const before = await observe(page);
    const matches = before.candidates.filter(c => sameSemantic(semantic(c), expected));
    try {
      eligible(before, expected.goal);
      if (stateDigest(before) !== this.recipe.steps[this.phase].expectedStateDigest) stop("RECIPE_STATE_DRIFT");
      if (matches.length !== 1) stop("RECIPE_DRIFT");
      await act(page, before, matches[0], expected.goal, request, signal, deadline);
      this.phase++;
      await step(`approved_recipe_${expected.goal}`);
    } catch (e) {
      await this.store.append("repair", {
        status: "proposed_only", approvalId: this.approvalId, recipeVersion: this.recipe.version,
        policyVersion: POLICY_VERSION, goal: expected.goal, expected: expected,
        observed: before.candidates.filter(c => c.goal === expected.goal).map(semantic),
        observationDigest: before.digest, requires: ["fresh_verified_discovery", "explicit_new_version_approval"],
        activeRecipeChanged: false,
      });
      throw e;
    }
  }
}