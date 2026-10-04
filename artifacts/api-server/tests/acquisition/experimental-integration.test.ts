import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AcquisitionService } from "../../src/goodwill/acquisition/service";
import { createExperimentalAcquisitionRouter, type ExperimentalAcquisitionRouterOptions } from "../../src/goodwill/acquisition/experimental/router";
import { FileMetadataStore } from "../../src/goodwill/acquisition/experimental/review";
import { scriptedGates, scriptedProvider } from "./experimental-helpers";
import { fixture, request, fakeReplay, TestArchive, TestRepository } from "./helpers";

export async function serveExperiments(options: ExperimentalAcquisitionRouterOptions) {
  const app = express(); app.use(express.json());
  app.use("/v2", createExperimentalAcquisitionRouter(options));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/v2`;
  return { server, async call(route: string, body?: unknown, operator = "owner") {
    const response = await fetch(base + route, { method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Test-Operator": operator }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  } };
}
export const testAuthorizer = async (req: express.Request) => ["owner", "reader"].includes(req.header("X-Test-Operator") ?? "")
  ? req.header("X-Test-Operator")! : null;
export const testReviewer = async (_req: express.Request, id: string) => id === "owner";
const frozen = { sourceId: request.sourceId, reportType: request.reportType, period: request.period };

test("authenticated experiment API is fail-closed, frozen, read-only and truthful with no provider", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "experiment-api-"));
  const repository = new TestRepository();
  const acquisition = new AcquisitionService({ repository, archive: new TestArchive(), fixture, replay: fakeReplay });
  await acquisition.initialize();
  const store = new FileMetadataStore(temp);
  const api = await serveExperiments({ acquisition, store, source: null, authorizeOperator: testAuthorizer, authorizeReview: testReviewer });
  try {
    for (const [route, body] of [
      ["/experiments", undefined], ["/experiments/runs", { mode: "supervised-discovery", ...frozen }],
      ["/experiments/approvals", { confirmation: true }],
    ] as const) assert.equal((await api.call(route, body, "unauthorized")).status, 401);
    const listing = await api.call("/experiments");
    assert.equal(listing.status, 200); assert.equal(listing.cache, "no-store");
    assert.deepEqual(listing.body.recipes, []); assert.deepEqual(listing.body.approvals, []);
    assert.equal(listing.body.access.discoveryAuthorized, false);
    assert.equal(listing.body.access.provider, "JEV_DISABLED");
    assert.equal(listing.body.access.sourceConfigured, false);
    assert.equal(listing.body.access.approvalAuthorized, true);
    assert.match(listing.body.access.explanation, /consumed/);
    assert.equal((await api.call("/experiments", undefined, "reader")).body.access.approvalAuthorized, false);
    assert.equal((await api.call("/experiments/approvals", {}, "reader")).status, 403);
    const discovery = await api.call("/experiments/runs", { mode: "supervised-discovery", ...frozen });
    assert.equal(discovery.status, 403); assert.equal(discovery.body.code, "JEV_EXECUTION_NOT_AUTHORIZED");
    for (const body of [
      { mode: "wrong", ...frozen },
      { mode: "supervised-discovery", ...frozen, url: "https://marketplace.invalid" },
      { mode: "supervised-discovery", ...frozen, provider: "jev", spendingApproved: true },
      { mode: "supervised-discovery", ...frozen, sourceId: "live" },
      { mode: "supervised-discovery", ...frozen, reportType: "ledger" },
      { mode: "supervised-discovery", ...frozen, period: { ...request.period, url: "bad" } },
      { mode: "supervised-discovery", ...frozen, period: { startDate: "2026-08-30", endDate: "2026-08-01" } },
      { mode: "approved-replay", ...frozen },
      { mode: "supervised-discovery", ...frozen, approvalId: "approval-test" },
    ]) assert.equal((await api.call("/experiments/runs", body)).status, 400);
    assert.equal((await api.call("/experiments/runs", { mode: "approved-replay", ...frozen, approvalId: "recipe-not-approved" })).body.code, "UNAPPROVED_RECIPE");
    assert.equal((await api.call("/experiments/approvals", { recipeId: "recipe-test", expectedDigest: "a".repeat(64),
      verifiedRunId: "run-test", confirmation: false })).status, 400);
    assert.equal(repository.rows.size, 0); assert.deepEqual(await store.list(), []);
  } finally { await new Promise<void>(resolve => api.server.close(() => resolve())); await rm(temp, { recursive: true, force: true }); }
});

test("server discovery grants are bounded; listing never reserves; missing source/gates/grants prevent calls", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "experiment-grants-"));
  const acquisition = new AcquisitionService({ repository: new TestRepository(), archive: new TestArchive(), fixture, replay: fakeReplay });
  await acquisition.initialize();
  let reserved = 0, calls = 0;
  const discovery = {
    provider: { ...scriptedProvider, async decide(...args: Parameters<typeof scriptedProvider.decide>) { calls++; return scriptedProvider.decide(...args); } },
    gates: scriptedGates,
    authorizationStatus: async () => ({ authorized: true, explanation: "SCRIPTED TEST GRANT ONLY" }),
    authorizeExecution: async () => { reserved++; return false; },
  };
  const source = { fixture, replicaUrl: "http://127.0.0.1:9/replica", allowedOrigin: "http://127.0.0.1:9",
    launcher: { async launch(): Promise<never> { throw new Error("must not launch"); } } };
  try {
    for (const options of [
      { source: null, discovery },
      { source, discovery: { ...discovery, gates: { ...scriptedGates, syntheticPayloadApproved: false } } },
      { source, discovery },
      { source: { ...source, replicaUrl: "https://managed-development.invalid/replica", allowedOrigin: "https://managed-development.invalid" }, discovery },
    ]) {
      const api = await serveExperiments({ ...options, acquisition, store: new FileMetadataStore(temp), authorizeOperator: testAuthorizer });
      try {
        const prior = reserved;
        const list = await api.call("/experiments");
        assert.equal(list.body.access.provider, "SCRIPTED");
        assert.equal(list.body.access.spendingAuthorized, false);
        assert.equal(list.body.access.evaluatedThresholdsConfigured, false);
        assert.equal(reserved, prior);
        assert.notEqual((await api.call("/experiments/runs", { mode: "supervised-discovery", ...frozen })).status, 202);
      } finally { await new Promise<void>(resolve => api.server.close(() => resolve())); }
    }
    assert.equal(reserved, 1); assert.equal(calls, 0);
    assert.throws(() => createExperimentalAcquisitionRouter({ source, acquisition, store: new FileMetadataStore(temp),
      authorizeOperator: testAuthorizer, discovery: { ...discovery, maxCalls: 11 } }), { code: "INVALID_EXPERIMENT_BUDGET" });
    const unavailable = await serveExperiments({ acquisition, store: new FileMetadataStore(temp), source: null,
      authorizeOperator: async () => { throw new Error("private auth diagnostics"); } });
    try { const failure = await unavailable.call("/experiments"); assert.equal(failure.status, 503);
      assert.equal(failure.body.code, "AUTH_UNAVAILABLE"); assert.ok(!JSON.stringify(failure.body).includes("private auth diagnostics"));
    } finally { await new Promise<void>(resolve => unavailable.server.close(() => resolve())); }
  } finally { await rm(temp, { recursive: true, force: true }); }
});