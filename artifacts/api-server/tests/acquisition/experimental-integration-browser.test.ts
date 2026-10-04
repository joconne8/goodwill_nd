import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { AcquisitionService } from "../../src/goodwill/acquisition/service";
import { createExperimentalAcquisitionRouter } from "../../src/goodwill/acquisition/experimental/router";
import { createLocalSyntheticReplica } from "../../src/goodwill/acquisition/experimental/local-replica";
import { BrowserReplay } from "../../src/goodwill/acquisition/browser";
import { assertRecipe, RecipeReview, type Recipe, type MetadataStore } from "../../src/goodwill/acquisition/experimental/review";
import { PostgresExperimentMetadataStore } from "../../src/goodwill/acquisition/experimental/postgres";
import { digest } from "../../src/goodwill/acquisition/experimental/policy";
import { goodwillBrowser } from "../../src/lib/goodwillAdapters";
import { pool } from "@workspace/db";
import { scriptedGates, scriptedProvider } from "./experimental-helpers";
import { fixture, request, fakeReplay, TestArchive, TestRepository, waitRun } from "./helpers";

test("actual runtime adapter + PostgreSQL JSONB: SCRIPTED discovery, explicit approval, restarted review and model-free replay", { timeout: 90000 }, async () => {
  const { build } = await import(process.env.GOODWILL_ESBUILD_MODULE!);
  const temp = await mkdtemp(path.join(tmpdir(), "experiment-route-browser-"));
  const app = express(); app.use(express.json());
  await build({ entryPoints: [path.resolve("artifacts/goodwill/src/features/acquisition/loopback-entry.tsx")],
    outfile: path.join(temp, "app.js"), bundle: true, platform: "browser", jsx: "automatic",
    define: { "import.meta.env.BASE_URL": JSON.stringify("/"), "process.env.NODE_ENV": JSON.stringify("production") } });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const acquisition = new AcquisitionService({ repository: new TestRepository(), archive: new TestArchive(), fixture, replay: fakeReplay });
  await acquisition.initialize();
  const client = await pool.connect();
  await client.query("BEGIN");
  await client.query("CREATE TEMP TABLE goodwill_v2_audit (id text PRIMARY KEY, document jsonb NOT NULL) ON COMMIT DROP");
  // The exact runtime PostgreSQL adapter, isolated on this connection. No shared
  // writes, fixture mutation, storage SDK operations or credential reads.
  const isolatedPool = { async connect() { return {
    async query(text: string, values?: unknown[]) { return client.query(text, values); }, release() {},
  }; } };
  const persistedStore = new PostgresExperimentMetadataStore(isolatedPool);
  let originalControlJson = "";
  const store: MetadataStore = {
    async append(kind, value) {
      if (kind === "recipe") originalControlJson = JSON.stringify((value as Recipe).steps[0].control);
      return persistedStore.append(kind, value);
    },
    read: id => persistedStore.read(id),
    list: () => persistedStore.list(),
  };
  if (!process.env.GOODWILL_CHROMIUM) throw new Error("Pass the approved system Chromium executable through GOODWILL_CHROMIUM.");
  const local = await createLocalSyntheticReplica({ fixture, bundlePath: path.join(temp, "app.js"),
    launcher: goodwillBrowser(process.env.GOODWILL_CHROMIUM) });
  const source = local.source;
  let calls = 0, reservations = 0, allow = true;
  const common = { acquisition, source,
    authorizeOperator: async (req: express.Request) => req.header("X-Test-Operator") === "owner" ? "owner" : null,
    authorizeReview: async () => true };
  app.use("/v2", createExperimentalAcquisitionRouter({ ...common, store, discovery: {
    provider: { kind: "scripted", async decide(p, signal) { calls++; return scriptedProvider.decide(p, signal); } },
    gates: scriptedGates,
    authorizationStatus: async () => ({ authorized: allow, explanation: "SCRIPTED test-only bounded grant" }),
    authorizeExecution: async (_req, _id, budget) => {
      assert.deepEqual(budget, { maxCalls: 10, maxInputTokens: 60000, callTimeoutMs: 1200 });
      if (!allow) return false; allow = false; reservations++; return true;
    },
  } }));
  // A new router/store instance reads the same immutable records after restart,
  // with NO discovery provider dependency.
  app.use("/restarted", createExperimentalAcquisitionRouter({ ...common, store: new PostgresExperimentMetadataStore(isolatedPool) }));
  const frozen = { sourceId: request.sourceId, reportType: request.reportType, period: request.period };
  const call = async (route: string, body?: unknown, base = "/v2") => {
    const response = await fetch(origin + base + route, { method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Test-Operator": "owner" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  try {
    const baseline = await acquisition.start(request, new BrowserReplay(source));
    assert.equal((await waitRun(acquisition, baseline.id)).state, "verified");
    assert.equal((await acquisition.resolveVerifiedRun(baseline.id)).manifest.runId, baseline.id);
    const access = (await call("/experiments")).body.access;
    assert.equal(access.discoveryAuthorized, true); assert.equal(access.provider, "SCRIPTED");
    assert.equal(reservations, 0); assert.equal(calls, 0);
    const queued = await call("/experiments/runs", { mode: "supervised-discovery", ...frozen });
    assert.equal(queued.status, 202);
    const run = await waitRun(acquisition, queued.body.id); assert.equal(run.state, "verified", JSON.stringify(run.failure));
    assert.equal(calls, 10); assert.equal(reservations, 1);
    const resolved = await acquisition.resolveVerifiedRun(run.id);
    assert.equal(resolved.manifest.runId, run.id);
    const list = (await call("/experiments")).body;
    assert.equal(list.access.discoveryAuthorized, false);
    assert.equal(list.recipes.length, 1); assert.equal(list.approvals.length, 0);
    const recipe = list.recipes[0]; assert.equal(recipe.kind, "scripted"); assert.match(recipe.label, /SCRIPTED/);
    const jsonbRecipe = await persistedStore.read(recipe.id) as Recipe;
    assert.notEqual(JSON.stringify(jsonbRecipe.steps[0].control), originalControlJson,
      "Regression must exercise real PostgreSQL JSONB object-key reordering");
    assert.equal(recipe.digest, digest(jsonbRecipe));
    const extraField = structuredClone(jsonbRecipe);
    Object.assign(extraField.steps[0].control, { selector: "#arbitrary" });
    assert.throws(() => assertRecipe(extraField), { code: "INVALID_RECIPE" });
    const changedControl = structuredClone(jsonbRecipe);
    changedControl.steps[0].control.operation = "fill";
    assert.throws(() => assertRecipe(changedControl), { code: "INVALID_RECIPE" });
    assert.equal(recipe.checksum, resolved.artifact.checksum);
    const approval = { recipeId: recipe.id, expectedDigest: recipe.digest, verifiedRunId: run.id, confirmation: true };
    assert.equal((await call("/experiments/approvals", { ...approval, expectedDigest: "0".repeat(64) })).body.code, "REVIEW_VERSION_CHANGED");
    assert.notEqual((await call("/experiments/approvals", { ...approval, verifiedRunId: "nonexistent" })).status, 201);
    assert.equal((await call("/experiments/approvals", { ...approval, reviewerRole: "process-owner" })).status, 400);
    const approved = await call("/experiments/approvals", approval); assert.equal(approved.status, 201);
    const restartedReview = new RecipeReview(new PostgresExperimentMetadataStore(isolatedPool), id => acquisition.resolveVerifiedRun(id));
    const bound = await restartedReview.approved(approved.body.id);
    assert.equal(bound.approval.recipeDigest, digest(bound.recipe));
    assert.equal(bound.approval.recipeDigest, recipe.digest);
    assert.equal(bound.approval.verifiedRunId, run.id);
    assert.equal(bound.approval.artifactId, resolved.artifact.artifactId);
    const changedValidControl = structuredClone(bound.recipe);
    changedValidControl.steps[0].control.name = "Report center"; // approved allowlist, but different exact version
    assertRecipe(changedValidControl);
    const tamperedRead: MetadataStore = { ...store, read: async id => id === recipe.id ? changedValidControl : store.read(id) };
    await assert.rejects(new RecipeReview(tamperedRead, id => acquisition.resolveVerifiedRun(id)).approved(approved.body.id),
      { code: "REVIEW_VERSION_CHANGED" });
    const persisted = (await call("/experiments", undefined, "/restarted")).body;
    assert.equal(persisted.approvals[0].id, approved.body.id); assert.equal(persisted.access.replayAvailable, true);
    assert.equal(persisted.access.provider, "JEV_DISABLED");
    const replay = await call("/experiments/runs", { mode: "approved-replay", approvalId: approved.body.id, ...frozen,
      period: { startDate: "2026-08-08", endDate: "2026-08-14" } }, "/restarted");
    assert.equal(replay.status, 202);
    const replayed = await waitRun(acquisition, replay.body.id);
    assert.equal(replayed.state, "verified", JSON.stringify(replayed.failure)); assert.equal(calls, 10);
    assert.equal((await acquisition.resolveVerifiedRun(replayed.id)).manifest.runId, replayed.id);
    assert.equal((await call("/experiments/runs", { mode: "supervised-discovery", ...frozen })).status, 403);
    assert.equal(reservations, 1); assert.equal(calls, 10);
    const repairs = (await call("/experiments")).body.repairCount; assert.equal(repairs, 0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve())); await local.close();
    await client.query("ROLLBACK"); client.release(); await pool.end();
    await rm(temp, { recursive: true, force: true });
  }
});