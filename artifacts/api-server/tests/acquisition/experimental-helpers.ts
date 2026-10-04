import { GOALS, MODEL } from "../../src/goodwill/acquisition/experimental/policy";
import type { DecisionProvider, ExperimentGates } from "../../src/goodwill/acquisition/experimental/provider";
export const scriptedGates: ExperimentGates = {
  syntheticPayloadApproved: true, accessApproved: false, spendingApproved: false,
  evaluation: { id: "scripted-smoke-NOT-measured", model: MODEL, heldOut: false,
    choiceFloors: Object.fromEntries(GOALS.map(g => [g, 0.9])) as Record<typeof GOALS[number], number>, blockingCeiling: 0.1 },
};
export const scriptedProvider: DecisionProvider = {
  kind: "scripted",
  async decide(p) {
    const selected = p.state.controls.find(c => c.goal === p.state.goal)?.id ?? "abstain";
    return { model: MODEL, answers: { target: { type: "choice", choice: selected,
      probabilities: Object.fromEntries(Object.keys(p.questions.target.criteria).map(k => [k, k === selected ? 1 : 0])), confidence: 1 },
      blocked: { type: "noul", noul: 0 } }, usage: { input_tokens: 100, output_tokens: 12 } };
  },
};