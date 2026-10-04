import test from "node:test";
import assert from "node:assert/strict";
import { StartGoodwillRunResponse, GetGoodwillRunResponse } from "@workspace/api-zod";
import { AcquisitionService, AcquisitionError, verifyDownload, sha256 } from "../../src/goodwill/acquisition";
import { fixture, request, TestRepository, TestArchive, fakeReplay, waitRun } from "./helpers";

const make = (replay = fakeReplay, timeoutMs = 1000) => {
  const repository = new TestRepository(), archive = new TestArchive();
  return { repository, archive, service: new AcquisitionService({ repository, archive, replay, fixture, timeoutMs }) };
};
test("queued -> downloaded -> verified preserves manifest and identity across service instances", async () => {
  const { service, repository, archive } = make();
  await service.initialize();
  const queued = await service.start(request);
  assert.equal(queued.state, "queued"); assert.ok(StartGoodwillRunResponse.safeParse(queued).success);
  const run = await waitRun(service, queued.id);
  assert.equal(run.state, "verified"); assert.ok(GetGoodwillRunResponse.safeParse(run).success);
  assert.equal(archive.calls, 1); assert.ok(run.steps?.some(s => s.name === "downloaded"));
  const resolved = await service.resolveVerifiedRun(run.id);
  assert.equal(resolved.manifest.runId, run.id); assert.equal(resolved.manifest.checksum, sha256(resolved.bytes));
  assert.equal(resolved.manifest.downloadedAt, run.downloadedAt);
  const restarted = new AcquisitionService({ repository, archive, replay: fakeReplay, fixture });
  await restarted.initialize();
  assert.deepEqual(await restarted.get(run.id), run);
  assert.deepEqual((await restarted.resolveVerifiedRun(run.id)).bytes, resolved.bytes);
  assert.equal((await restarted.cancel(run.id)).state, "verified");
});
test("exact downloaded periods differ; independent expected counts are 141 and 129", async () => {
  const a = await fakeReplay.acquire(request, new AbortController().signal, async () => {});
  const second = { ...request, period: { startDate: "2026-08-08", endDate: "2026-08-14" } };
  const b = await fakeReplay.acquire(second, new AbortController().signal, async () => {});
  assert.equal(verifyDownload(request, a, fixture).checksum, sha256(a.bytes));
  verifyDownload(second, b, fixture);
  assert.notEqual(sha256(a.bytes), sha256(b.bytes));
  assert.equal(new TextDecoder().decode(a.bytes).trim().split("\n").length - 1, 141);
  assert.equal(new TextDecoder().decode(b.bytes).trim().split("\n").length - 1, 129);
});
test("wrong dates, filename, hash, bytes, identity, UTF8 and empty/header-only reports reject", async () => {
  const e = await fakeReplay.acquire(request, new AbortController().signal, async () => {});
  for (const [patch, code] of [
    [{ startDate: "2026-08-02" }, "WRONG_REPORT_DATES"], [{ checksum: "0".repeat(64) }, "CHECKSUM_MISMATCH"],
    [{ sourceId: "ebay" }, "INVALID_REPORT_IDENTITY"], [{ filename: "../report.csv" }, "INVALID_FILENAME"],
    [{ timezone: "America/Los_Angeles" }, "INVALID_REPORT_IDENTITY"],
  ] as const) assert.throws(() => verifyDownload(request, { ...e, manifest: { ...e.manifest, ...patch } as typeof e.manifest }, fixture), { code });
  assert.throws(() => verifyDownload(request, { ...e, bytes: new Uint8Array() }, fixture), { code: "INVALID_FILE_SIZE" });
  assert.throws(() => verifyDownload(request, { ...e, downloadedAt: "2026-02-30T10:00:00Z" }, fixture), { code: "INVALID_DOWNLOAD_TIME" });
  for (const [text, code] of [[new Uint8Array([255]), "INVALID_ENCODING"],
    [new TextEncoder().encode("wrong,header\n1,2\n"), "INVALID_HEADER"],
    [new TextEncoder().encode(new TextDecoder().decode(e.bytes).split("\n")[0] + "\n"), "EMPTY_REPORT"]] as const) {
    assert.throws(() => verifyDownload(request, { ...e, bytes: text,
      manifest: { ...e.manifest, checksum: sha256(text), byteSize: text.length } }, fixture), { code });
  }
});
test("unsupported dates and unknown URL/path parameters never create a run", async () => {
  const { service, repository } = make(); await service.initialize();
  for (const bad of [
    { ...request, url: "https://untrusted.example" }, { ...request, path: "/etc/passwd" },
    { ...request, period: { startDate: "2026-07-01", endDate: "2026-08-07" } },
    { ...request, period: { startDate: "2026-08-10", endDate: "2026-08-01" } },
    { ...request, period: { ...request.period, timezone: "UTC" } },
    { ...request, scenario: "unknown" },
  ]) await assert.rejects(service.start(bad));
  assert.equal(repository.rows.size, 0);
});
test("cancellation beats a late download; no archive or intake delivery", async () => {
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const { service, archive } = make({ async acquire(req, signal, step) {
    await gate; return fakeReplay.acquire(req, signal, step);
  } });
  await service.initialize(); const q = await service.start(request);
  await service.cancel(q.id); release();
  await new Promise(r => setTimeout(r, 30));
  assert.equal((await service.cancel(q.id)).state, "cancelled");
  assert.equal(archive.calls, 0);
  await assert.rejects(service.resolveVerifiedRun(q.id), { code: "RUN_NOT_VERIFIED" });
});
test("hung replay times out; only one explicit linked retry, including concurrent callers", async () => {
  const { service, archive } = make({ acquire: () => new Promise(() => {}) }, 25);
  await service.initialize(); const q = await service.start(request);
  const failed = await waitRun(service, q.id);
  assert.equal(failed.failure?.code, "RUN_TIMEOUT"); assert.equal(archive.calls, 0);
  const results = await Promise.allSettled([service.start({ ...request, retryOf: q.id }), service.start({ ...request, retryOf: q.id })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const retry = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof service.start>>>;
  assert.equal(retry.value.attempt, 2);
  await waitRun(service, retry.value.id);
  await assert.rejects(service.start({ ...request, retryOf: retry.value.id }), { code: "RETRY_NOT_ALLOWED" });
});
test("timeout during a slow journal update still aborts an uncooperative replay", async () => {
  const { service, repository } = make({ acquire: () => new Promise(() => {}) }, 5);
  const replace = repository.replace.bind(repository);
  repository.replace = async (run, states) => {
    if (run.lastStep === "browser_start" && run.state === "running")
      await new Promise(resolve => setTimeout(resolve, 25));
    return replace(run, states);
  };
  await service.initialize(); const q = await service.start(request);
  assert.equal((await waitRun(service, q.id)).failure?.code, "RUN_TIMEOUT");
});
test("worker restart marks unfinished runs interrupted, not successful or automatically retried", async () => {
  const { service, repository } = make(); await service.initialize();
  const at = new Date().toISOString();
  await repository.create({ id: "interrupted", request, state: "downloaded", createdAt: at, updatedAt: at,
    attempt: 1, lastStep: "downloaded", artifact: null, failure: null, contractVersion: "2.0.0" });
  await service.initialize();
  assert.equal((await service.get("interrupted")).failure?.code, "RUN_INTERRUPTED");
});
test("archive corruption and adapter identity mismatch fail closed without financial writes", async () => {
  const { service, archive } = make(); await service.initialize();
  const q = await service.start(request); const r = await waitRun(service, q.id);
  archive.objects.set(r.artifact!.artifactId, new Uint8Array([1]));
  await assert.rejects(service.resolveVerifiedRun(q.id), { code: "ARCHIVE_CHECKSUM_MISMATCH" });
  const other = make(); other.archive.put = async () => ({ artifactId: "/arbitrary/path", filename: "bad",
    checksum: "0".repeat(64), byteSize: 1, archivedAt: new Date().toISOString(), synthetic: true });
  await other.service.initialize(); const x = await other.service.start(request);
  assert.equal((await waitRun(other.service, x.id)).failure?.code, "ARCHIVE_IDENTITY_MISMATCH");
  const invalidDate = make();
  const put = invalidDate.archive.put.bind(invalidDate.archive);
  invalidDate.archive.put = async (...args) => ({ ...await put(...args), archivedAt: "invalid", csv: "never persist raw files" });
  await invalidDate.service.initialize(); const y = await invalidDate.service.start(request);
  const rejected = await waitRun(invalidDate.service, y.id);
  assert.equal(rejected.failure?.code, "ARCHIVE_IDENTITY_MISMATCH");
  assert.equal(rejected.artifact, null);
});
test("typed browser failure records last completed step and actionable safe evidence", async () => {
  const { service } = make({ async acquire(_req, _signal, step) {
    await step("replica-confirm"); throw new AcquisitionError("SESSION_EXPIRED", "Simulated session expired.", true, "Reauthenticate explicitly.");
  } }); await service.initialize();
  const q = await service.start(request); const r = await waitRun(service, q.id);
  assert.equal(r.lastStep, "replica-confirm"); assert.equal(r.failure?.code, "SESSION_EXPIRED");
  assert.equal(r.failure?.nextAction, "Reauthenticate explicitly.");
  assert.ok(!JSON.stringify(r).includes("cookies"));
});