import { createHash } from "node:crypto";
import { AcquisitionError, aborted, type Request } from "../contracts";
import type { Page } from "../browser";

export const POLICY_VERSION = "synthetic-controls-1";
export const QUESTION_VERSION = "atomic-selection-1";
export const MODEL = "jev-1.13.0";
export const GOALS = ["reports", "paid-orders", "start", "end", "timezone", "channel", "payment", "generate", "confirm", "download"] as const;
export type Goal = typeof GOALS[number];
export type Operation = "click" | "fill" | "select";
export interface SemanticControl {
  goal: Goal; tag: "button" | "input" | "select"; name: string; type: string; operation: Operation;
}
export interface Candidate extends SemanticControl { id: string; testId: string }
export interface Observation {
  id: string; observedAt: number; synthetic: true; blocking: boolean;
  candidates: Candidate[]; digest: string;
}
const rules: Record<Goal, { tag: SemanticControl["tag"]; operation: Operation; names: string[]; type?: string }> = {
  reports: { tag: "button", operation: "click", names: ["Reports", "Report center"] },
  "paid-orders": { tag: "button", operation: "click", names: ["Paid orders", "Paid item reports"] },
  start: { tag: "input", operation: "fill", names: ["Start", "Start date"], type: "date" },
  end: { tag: "input", operation: "fill", names: ["End", "End date"], type: "date" },
  timezone: { tag: "select", operation: "select", names: ["Timezone", "Reporting timezone"] },
  channel: { tag: "select", operation: "select", names: ["Channel", "Sales channel"] },
  payment: { tag: "select", operation: "select", names: ["Payment status", "Payment filter"] },
  generate: { tag: "button", operation: "click", names: ["Generate report", "Create report"] },
  confirm: { tag: "button", operation: "click", names: ["Confirm and generate", "Confirm report"] },
  download: { tag: "button", operation: "click", names: ["Download report"] },
};
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function stop(code: string): never {
  throw new AcquisitionError(code, "Synthetic experimental acquisition stopped safely.", false,
    "Review the redacted decision/repair record. Use manual CSV upload or explicitly start a new deterministic run.");
}
export function semantic(c: Candidate): SemanticControl {
  return { goal: c.goal, tag: c.tag, name: c.name, type: c.type, operation: c.operation };
}
export function validSemantic(c: SemanticControl) {
  if (!c || typeof c !== "object" || Array.isArray(c) ||
      Object.keys(c).sort().join(",") !== "goal,name,operation,tag,type") return false;
  const rule = rules[c.goal];
  return !!rule && rule.tag === c.tag && rule.operation === c.operation &&
    rule.names.includes(c.name) && (rule.type ? c.type === rule.type : typeof c.type === "string" && c.type.length <= 20);
}
/** JSONB may reorder object keys. Match validated fields without changing the
 * historical JSON digest used for immutable recipe/version approval identity. */
export function sameSemantic(a: SemanticControl, b: SemanticControl): boolean {
  return validSemantic(a) && validSemantic(b) &&
    a.goal === b.goal && a.tag === b.tag && a.name === b.name &&
    a.type === b.type && a.operation === b.operation;
}
/** Replay state identity ignores DOM enumeration/IDs, but not semantic control drift. */
export const stateDigest = (o: Observation) => digest({
  blocking: o.blocking, synthetic: o.synthetic,
  controls: o.candidates.map(c => semantic(c)).sort((a, b) => digest(a).localeCompare(digest(b))),
});
/** Only approved visible controls. No HTML, URLs, text fields, cookies or report rows. */
export async function observe(page: Page): Promise<Observation> {
  if (!page.evaluate) stop("OBSERVATION_UNAVAILABLE");
  const raw = await page.evaluate(() => {
    // DOM types intentionally structural: the server TypeScript project has no DOM lib.
    const doc = (globalThis as unknown as { document: {
      querySelector(s: string): { textContent: string | null } | null;
      querySelectorAll(s: string): Iterable<{
        tagName: string; type?: string; disabled?: boolean; textContent: string | null;
        getAttribute(s: string): string | null; getClientRects(): { length: number };
        closest(s: string): { childNodes: Iterable<{ nodeType: number; textContent: string | null }> } | null;
      }>;
    } }).document;
    return {
      synthetic: doc.querySelector('[data-testid="replica-disclosure"]')?.textContent?.includes("Synthetic.") === true,
      blocking: !!doc.querySelector('[data-testid="replica-error"]'),
      controls: Array.from(doc.querySelectorAll("button[data-testid], input[data-testid], select[data-testid]"))
        .filter(e => e.getClientRects().length && !e.disabled)
        .map(e => ({
          testId: e.getAttribute("data-testid") ?? "", tag: e.tagName.toLowerCase(), type: e.type ?? "",
          name: e.tagName === "BUTTON" ? (e.textContent ?? "").trim() :
            Array.from(e.closest("label")?.childNodes ?? []).filter(n => n.nodeType === 3).map(n => n.textContent ?? "").join("").trim(),
        })),
    };
  });
  if (!raw.synthetic) stop("NOT_SYNTHETIC");
  if (raw.controls.length > 32) stop("CANDIDATE_LIMIT");
  const candidates: Candidate[] = [];
  for (const c of raw.controls) {
    // Restrict selectors to this local replica's reserved namespace, then map semantics.
    if (!/^replica-[a-z-]{1,40}$/.test(c.testId)) continue;
    let name = c.name;
    if (/^Download synthetic_upright_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(name)) name = "Download report";
    const matches = GOALS.filter(g => (c.testId === `replica-${g}` ||
      (g === "generate" && c.testId === "replica-generate-moved")) &&
      rules[g].tag === c.tag && rules[g].names.includes(name) &&
      (!rules[g].type || rules[g].type === c.type));
    if (matches.length !== 1) continue; // Hostile/unknown names never sent to a model.
    const goal = matches[0], rule = rules[goal];
    candidates.push({ id: `c${candidates.length}`, testId: c.testId, goal, tag: rule.tag, type: c.type, name, operation: rule.operation });
  }
  const snapshot = { blocking: raw.blocking, candidates };
  return { ...snapshot, id: digest(snapshot), digest: digest(snapshot), synthetic: true, observedAt: Date.now() };
}
export function exactValue(goal: Goal, request: Request): string | undefined {
  switch (goal) {
    case "start": return request.period.startDate;
    case "end": return request.period.endDate;
    case "timezone": return "America/New_York";
    case "channel": return "all";
    case "payment": return "paid";
    default: return undefined;
  }
}
export function eligible(observation: Observation, goal: Goal) {
  if (observation.blocking) stop("PORTAL_BLOCKED");
  const controls = observation.candidates.filter(c => c.goal === goal);
  if (controls.length !== 1) stop("AMBIGUOUS_CONTROL");
  // Other permitted targets remain options, but policy still requires the phase goal.
  return observation.candidates;
}
export async function act(page: Page, snapshot: Observation, candidate: Candidate, goal: Goal, request: Request,
  signal: AbortSignal, deadline: number) {
  aborted(signal);
  if (Date.now() >= deadline) stop("EXPERIMENT_DEADLINE");
  if (Date.now() - snapshot.observedAt > 1500) stop("STALE_OBSERVATION");
  const current = await observe(page);
  if (current.digest !== snapshot.digest || !snapshot.candidates.some(c => digest(c) === digest(candidate))) stop("STALE_OBSERVATION");
  eligible(current, goal);
  if (candidate.goal !== goal || candidate.operation !== rules[goal].operation) stop("UNSAFE_ACTION");
  const locator = page.locator(`[data-testid="${candidate.testId}"]`);
  if (await locator.count() !== 1) stop("AMBIGUOUS_CONTROL");
  const value = exactValue(goal, request);
  if (candidate.operation === "fill") await locator.fill(value!);
  else if (candidate.operation === "select") await locator.selectOption(value!);
  else await locator.click();
  aborted(signal);
  const after = await observe(page);
  if (after.blocking) stop("PORTAL_BLOCKED");
  if (value !== undefined) {
    if (await locator.getAttribute("value") !== value && candidate.tag === "input") stop("POSTCONDITION_FAILED");
    // React select 'value' is a property, not an HTML attribute.
    if (candidate.tag === "select" && await page.locator(`[data-testid="${candidate.testId}"] option:checked`).getAttribute("value") !== value)
      stop("POSTCONDITION_FAILED");
  }
  if (goal === "reports" && after.candidates.some(c => c.goal === "start")) stop("POSTCONDITION_FAILED");
  if (goal === "paid-orders" && !after.candidates.some(c => c.goal === "start")) stop("POSTCONDITION_FAILED");
  if (goal === "generate" && !after.candidates.some(c => c.goal === "confirm")) stop("POSTCONDITION_FAILED");
  if (goal === "confirm" && after.candidates.some(c => c.goal === "confirm")) stop("POSTCONDITION_FAILED");
  return after;
}