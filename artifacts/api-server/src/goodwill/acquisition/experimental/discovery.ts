import type { BrowserControls, Page } from "../browser";
import { aborted, type Request, type Step } from "../contracts";
import { act, eligible, GOALS, MODEL, observe, POLICY_VERSION, QUESTION_VERSION, semantic, stateDigest, stop, type Goal, type SemanticControl } from "./policy";
import { assertGates, payloadFor, validateAnswer, type DecisionProvider, type ExperimentGates } from "./provider";

export interface DecisionReview {
  kind: "jev" | "scripted"; model: string; policyVersion: string; questionVersion: string; recipeVersion: string;
  goal: Goal; observationId: string; candidateIds: string[]; selected: string | null;
  distribution: Record<string, number> | null; choiceConfidence: number | null; blockingProbability: number | null;
  before: { digest: string; uniqueTarget: boolean; synthetic: true };
  after: { digest: string; assertionsPassed: true } | null;
  elapsedMs: number; usage: { inputTokens: number | null; outputTokens: number | null; reservedInputTokens: number };
  evaluationId: string; choiceFloor: number; blockingCeiling: number;
  outcome: string;
}
export interface TraceStep { control: SemanticControl; beforeDigest: string; afterDigest: string; expectedStateDigest: string }
export class DiscoveryControls implements BrowserControls {
  readonly trace: TraceStep[] = [];
  calls = 0; inputTokens = 0; reservedInputTokens = 0;
  private phase = 0;
  constructor(private options: {
    provider: DecisionProvider; gates: ExperimentGates;
    /** Must persist redacted records; failure stops rather than losing review evidence. */
    record: (record: DecisionReview) => Promise<void>;
    maxCalls?: number; maxInputTokens?: number; callTimeoutMs?: number;
  }) {}
  async prepare(page: Page, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    assertGates(this.options.gates, this.options.provider);
    for (const goal of GOALS.slice(0, -1)) await this.select(page, goal, request, signal, step, deadline);
  }
  async download(page: Page, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    await this.select(page, "download", request, signal, step, deadline);
  }
  private async select(page: Page, goal: Goal, request: Request, signal: AbortSignal, step: Step, deadline: number) {
    aborted(signal);
    assertGates(this.options.gates, this.options.provider);
    if (GOALS[this.phase] !== goal) stop("INVALID_TRANSITION");
    const before = await observe(page);
    eligible(before, goal);
    const payload = payloadFor(before, goal);
    // Byte count is a conservative token reservation, NOT measured token usage.
    const reserved = Buffer.byteLength(JSON.stringify(payload));
    if (reserved > 8192 || this.calls >= Math.min(this.options.maxCalls ?? 10, 10) ||
      this.reservedInputTokens + reserved > Math.min(this.options.maxInputTokens ?? 60000, 60000)) stop("EXPERIMENT_BUDGET");
    const remaining = Math.min(deadline - Date.now(), this.options.callTimeoutMs ?? 1200, 1200);
    if (remaining <= 0) stop("EXPERIMENT_DEADLINE");
    this.calls++; this.reservedInputTokens += reserved;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    const began = Date.now();
    const record: DecisionReview = {
      kind: this.options.provider.kind, model: MODEL, policyVersion: POLICY_VERSION, questionVersion: QUESTION_VERSION,
      recipeVersion: "discovery-draft-1", goal, observationId: before.id,
      evaluationId: this.options.gates.evaluation!.id, choiceFloor: this.options.gates.evaluation!.choiceFloors[goal],
      blockingCeiling: this.options.gates.evaluation!.blockingCeiling,
      candidateIds: [...before.candidates.map(c => c.id), "abstain"], selected: null, distribution: null,
      choiceConfidence: null, blockingProbability: null, before: { digest: before.digest, uniqueTarget: true, synthetic: true },
      after: null, elapsedMs: 0, usage: { inputTokens: null, outputTokens: null, reservedInputTokens: reserved }, outcome: "not_completed",
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort: (() => void) | undefined;
    try {
      const interrupted = new Promise<never>((_, reject) => {
        rejectAbort = () => reject(new Error("provider interrupted"));
        controller.signal.addEventListener("abort", rejectAbort, { once: true });
        if (signal.aborted) controller.abort();
        timer = setTimeout(() => controller.abort(), remaining);
      });
      let raw: unknown;
      try { raw = await Promise.race([this.options.provider.decide(payload, controller.signal), interrupted]); }
      catch (e) {
        aborted(signal);
        if (controller.signal.aborted) stop("JEV_DECISION_TIMEOUT");
        throw e;
      }
      const answer = validateAnswer(raw, payload, reserved);
      this.inputTokens += answer.usage.input_tokens;
      record.selected = answer.answers.target.choice;
      record.distribution = answer.answers.target.probabilities;
      record.choiceConfidence = answer.answers.target.confidence;
      record.blockingProbability = answer.answers.blocked.noul;
      record.usage.inputTokens = answer.usage.input_tokens; record.usage.outputTokens = answer.usage.output_tokens;
      const evaluation = this.options.gates.evaluation!;
      const floor = evaluation.choiceFloors[goal];
      if (!Number.isFinite(floor) || floor <= 0 || floor > 1) stop("THRESHOLDS_NOT_APPROVED");
      if (answer.answers.target.choice === "abstain") stop("JEV_ABSTAINED");
      if (answer.answers.target.confidence < floor || answer.answers.blocked.noul > evaluation.blockingCeiling) stop("JEV_LOW_CONFIDENCE");
      const selected = before.candidates.find(c => c.id === answer.answers.target.choice);
      if (!selected) stop("INVALID_PROVIDER_RESPONSE");
      const after = await act(page, before, selected, goal, request, signal, deadline);
      record.after = { digest: after.digest, assertionsPassed: true };
      this.trace.push({ control: semantic(selected), beforeDigest: before.digest, afterDigest: after.digest, expectedStateDigest: stateDigest(before) });
      this.phase++;
      record.outcome = "assertions_passed";
      await step(`experimental_${goal}`);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      record.outcome = signal.aborted ? "CANCELLED" : /^[A-Z_]{1,64}$/.test(code) ? code : "PROVIDER_FAILED";
      throw e;
    } finally {
      clearTimeout(timer);
      if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
      signal.removeEventListener("abort", cancel);
      controller.abort();
      record.elapsedMs = Date.now() - began;
      await this.options.record(record);
    }
  }
}