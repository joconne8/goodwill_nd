import test from "node:test";
import assert from "node:assert/strict";
import {
  GetGoodwillExperimentsResponse,
  StartGoodwillExperimentRunBody, StartGoodwillExperimentRunResponse,
  ApproveGoodwillExperimentRecipeBody, ApproveGoodwillExperimentRecipeResponse,
} from "@workspace/api-zod";

const period = { startDate: "2026-08-01", endDate: "2026-08-31" };
const request = { sourceId: "upright", reportType: "paid_order_items", period };
const approval = { recipeId: "recipe-example", expectedDigest: "a".repeat(64), verifiedRunId: "run-example", confirmation: true };
// Orval's object validators strip unknown fields by default. The existing
// experimental router enforces exact fields; check the same strict branches here.
const strictRun = (input: unknown) => StartGoodwillExperimentRunBody.options.some(branch => branch.strict().safeParse(input).success);
const strictApproval = (input: unknown) => ApproveGoodwillExperimentRecipeBody.options.some(branch => branch.strict().safeParse(input).success);

test("experimental run contract freezes mode, source, report and August period without client URLs or grants", () => {
  assert.equal(strictRun({ ...request, mode: "supervised-discovery" }), true);
  assert.equal(strictRun({ ...request, mode: "approved-replay", approvalId: "approval-example" }), true);
  for (const input of [
    { ...request, mode: "approved-replay" },
    { ...request, mode: "supervised-discovery", approvalId: "approval-example" },
    { ...request, mode: "live-discovery" },
    { ...request, mode: "supervised-discovery", sourceId: "ebay" },
    { ...request, mode: "supervised-discovery", reportType: "orders" },
    { ...request, mode: "supervised-discovery", period: { ...period, startDate: "2026-08-00" } },
    { ...request, mode: "supervised-discovery", period: { ...period, endDate: "2026-09-01" } },
    { ...request, mode: "supervised-discovery", replicaUrl: "https://vendor.invalid/" },
    { ...request, mode: "supervised-discovery", spendingApproved: true },
    { ...request, mode: "supervised-discovery", grants: { approved: true } },
  ]) assert.equal(strictRun(input), false, JSON.stringify(input));
  assert.deepEqual(StartGoodwillExperimentRunResponse.parse({ id: "run-example" }), { id: "run-example" });
});

test("experimental approval contract requires verified-run binding, exact digest and explicit true confirmation", () => {
  assert.equal(strictApproval(approval), true);
  const { expectedDigest, ...rest } = approval;
  assert.equal(strictApproval({ ...rest, digest: expectedDigest }), true);
  for (const input of [
    { ...rest }, { ...approval, confirmation: false }, { ...approval, expectedDigest: "not-a-digest" },
    { ...approval, digest: expectedDigest }, { ...approval, reviewerRole: "process-owner" },
    { ...approval, verifiedRunId: undefined },
  ]) assert.equal(strictApproval(input), false, JSON.stringify(input));
  assert.deepEqual(ApproveGoodwillExperimentRecipeResponse.parse({ id: "approval-example" }), { id: "approval-example" });
});

test("experiment review wire schema includes complete access gates and safe recipe/approval version summaries", () => {
  const goals = ["reports", "paid-orders", "start", "end", "timezone", "channel", "payment", "generate", "confirm", "download"];
  const review = {
    recipes: [{
      id: "recipe-example", digest: "a".repeat(64), version: "synthetic-version-1",
      kind: "scripted", label: "SCRIPTED — not measured Jev", checksum: "b".repeat(64), byteSize: 100, period,
      steps: goals.map(goal => ({ goal, operation: ["start", "end"].includes(goal) ? "fill" :
        ["timezone", "channel", "payment"].includes(goal) ? "select" : "click", name: goal })),
    }],
    approvals: [{ id: "approval-example", version: "synthetic-version-1", recipeId: "recipe-example", digest: "a".repeat(64), verifiedRunId: "run-example" }],
    repairCount: 0,
    access: {
      discoveryAuthorized: false, mode: "review-and-approved-replay", explanation: "Jev disabled; explicit model-free approval available.",
      provider: "JEV_DISABLED", providerConfigured: false, executionAuthorized: false, spendingAuthorized: false,
      evaluatedThresholdsConfigured: false, syntheticPayloadApproved: false, providerAccessApproved: false,
      sourceConfigured: true, sourceMode: "local-synthetic-replica", approvalAuthorized: true,
      approvedRecipeCount: 1, replayAvailable: true, policyVersion: "synthetic-controls-1",
    },
  };
  assert.deepEqual(GetGoodwillExperimentsResponse.parse(review), review);
  for (const n of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(GetGoodwillExperimentsResponse.safeParse({ ...review, repairCount: n }).success, false);
    assert.equal(GetGoodwillExperimentsResponse.safeParse({ ...review, access: { ...review.access, approvedRecipeCount: n } }).success, false);
  }
  assert.equal(GetGoodwillExperimentsResponse.safeParse({ ...review, access: { discoveryAuthorized: false, explanation: "Missing gate details" } }).success, false);
  assert.equal(GetGoodwillExperimentsResponse.safeParse({ ...review, recipes: [{ ...review.recipes[0], kind: "live" }] }).success, false);
  assert.equal(GetGoodwillExperimentsResponse.safeParse({ ...review, recipes: [{ ...review.recipes[0], byteSize: 10.5 }] }).success, false);
});