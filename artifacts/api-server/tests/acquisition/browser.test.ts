import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { AcquisitionService, BrowserReplay, AcquisitionError, createAcquisitionRouter, sha256, verifyDownload } from "../../src/goodwill/acquisition";
import { generateReport } from "../../src/lib/goodwill";
import { fixture, request, TestRepository, TestArchive, waitRun } from "./helpers";

test("real DOM replay/download, lifecycle, failure controls, run/manual intake wire contracts", { timeout: 90000 }, async () => {
  const modulePath = process.env.GOODWILL_PLAYWRIGHT_MODULE ?? "playwright";
  const playwright = await import(modulePath);
  const launcher = { launch: (options: { headless: true }) => playwright.chromium.launch({
    ...options, ...(process.env.GOODWILL_CHROMIUM ? { executablePath: process.env.GOODWILL_CHROMIUM } : {}),
  }) };
  const { build } = await import(process.env.GOODWILL_ESBUILD_MODULE!);
  const temp = await mkdtemp(path.join(tmpdir(), "goodwill-browser-ui-"));
  const app = express(); app.use(express.json());
  await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {ReplicaPortal,AcquisitionConsole} from './src/features/acquisition/index.ts';
        createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient()},
          React.createElement(location.pathname==='/acquisition'?AcquisitionConsole:ReplicaPortal)));`,
      resolveDir: path.resolve("artifacts/goodwill"), loader: "tsx",
    }, outfile: path.join(temp, "app.js"), bundle: true, platform: "browser", jsx: "automatic",
    define: { "import.meta.env.BASE_URL": JSON.stringify("/") },
  });
  app.get("/app.js", (_req, res) => res.sendFile(path.join(temp, "app.js")));
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Synthetic acquisition test harness</title><style>body{font:14px system-ui;margin:24px}button,input,select{padding:8px;margin:4px}table{border-collapse:collapse;width:100%}td,th{padding:6px;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere}[role=dialog]{position:fixed;inset:20%;background:white;border:2px solid;padding:24px}[role=alert]{color:#a00}</style></head>
    <body><div id="root"></div><script src="/app.js"></script></body></html>`;
  app.get(["/replica", "/acquisition"], (_req, res) => res.type("html").send(html));
  app.post("/api/goodwill/report", (req, res) => {
    try { res.json(generateReport(req.body, fixture)); }
    catch (e) { res.status(400).json({ code: (e as { code: string }).code, error: "Unsupported report request." }); }
  });
  app.get("/api/goodwill/sources", (_req, res) => res.json([
    { id: "upright", name: "Upright", acquisitionClass: "Browser CSV", accountingRole: "Synthetic paid items", status: "synthetic_fixture" },
  ]));
  app.get("/api/goodwill/v2/catalog", (_req, res) => res.json({ datasets: [
    { id: "upright-items", sourceId: "upright", reportType: "paid_order_items", filename: "synthetic.csv" },
  ], definitions: [], stores: [] }));
  // Transport spies are NOT data parsers or financial acceptance evidence.
  const uploads = new Map<string, { bytes?: Uint8Array; checksum: string; byteSize: number }>();
  const intakes: unknown[] = [];
  app.post("/api/goodwill/v2/uploads", (req, res) => {
    const id = `test-upload-${uploads.size + 1}`;
    uploads.set(id, req.body);
    res.status(201).json({ uploadId: id, uploadUrl: origin + "/test-put/" + id, expiresAt: new Date(Date.now() + 60000).toISOString() });
  });
  app.put("/test-put/:id", express.raw({ type: "*/*", limit: "5mb" }), (req, res) => {
    const upload = uploads.get(req.params.id);
    if (!upload || upload.byteSize !== req.body.length || sha256(req.body) !== upload.checksum) return res.sendStatus(400);
    upload.bytes = req.body; res.sendStatus(200);
  });
  app.post("/api/goodwill/v2/batches", (req, res) => {
    intakes.push(req.body);
    res.status(201).json({ id: "test-batch-" + intakes.length, state: "received", runId: req.body.inputKind === "run" ? req.body.inputId : null,
      sourceId: req.body.sourceId, reportType: req.body.reportType, period: req.body.period, inputRows: 0, acceptedRows: 0, rejectedRows: 0,
      failure: null, warnings: ["Transport test only: no data parser or publication is simulated."] });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const repository = new TestRepository(), archive = new TestArchive();
  const replay = new BrowserReplay({ launcher, replicaUrl: origin + "/replica", allowedOrigin: origin, waitMs: 5000 });
  const service = new AcquisitionService({ repository, archive, replay, fixture, timeoutMs: 7000 });
  await service.initialize();
  app.use("/api/goodwill/v2", createAcquisitionRouter(service));
  const evidenceDir = "docs/goodwill/acquisition/evidence";
  await mkdir(evidenceDir, { recursive: true });
  const cases: unknown[] = [], started = Date.now();
  const lastGoodUrl = process.env.GOODWILL_LAST_GOOD_CHECK_URL;
  const before = lastGoodUrl ? await (await fetch(lastGoodUrl)).text() : null;
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | undefined;
  try {
    for (const period of [
      { startDate: "2026-08-01", endDate: "2026-08-07" }, { startDate: "2026-08-08", endDate: "2026-08-14" },
    ]) {
      const queued = await service.start({ ...request, period });
      const done = await waitRun(service, queued.id);
      assert.equal(done.state, "verified", JSON.stringify(done.failure));
      const acquired = await service.resolveVerifiedRun(done.id);
      const expected = generateReport(period, fixture);
      assert.equal(new TextDecoder().decode(acquired.bytes), expected.csv);
      await writeFile(path.join(evidenceDir, done.artifact!.filename), acquired.bytes);
      cases.push({ case: "download", expected: expected.checksum, actual: sha256(acquired.bytes),
        expectedBytes: Buffer.byteLength(expected.csv), actualBytes: acquired.bytes.length, run: done });
    }
    const hashes = [...archive.objects.values()].map(sha256); assert.notEqual(hashes[0], hashes[1]);
    for (const [scenario, expectedCode] of [
      ["delayed", null], ["session_expired", "SESSION_EXPIRED"], ["dom_drift", "DOM_DRIFT"], ["missing_report", "MISSING_REPORT"],
    ] as const) {
      const q = await service.start({ ...request, scenario });
      const run = await waitRun(service, q.id);
      assert.equal(run.state, expectedCode ? "failed" : "verified", JSON.stringify(run.failure));
      if (expectedCode) { assert.equal(run.failure?.code, expectedCode); assert.equal(run.artifact, null); }
      cases.push({ case: scenario, expectedCode, actualCode: run.failure?.code ?? null, lastStep: run.lastStep });
    }
    for (const [fault, code] of [["wrong_dates", "WRONG_REPORT_DATES"], ["failed_download", "DOWNLOAD_FAILED"]] as const) {
      const r = new BrowserReplay({ launcher, replicaUrl: origin + "/replica", allowedOrigin: origin, waitMs: 2000, testFault: fault });
      await assert.rejects(r.acquire(request, new AbortController().signal, async () => {}), (e: unknown) => {
        assert.equal((e as AcquisitionError).code, code); return true;
      });
      cases.push({ case: fault, expectedCode: code, actualCode: code });
    }
    const q = await service.start({ ...request, scenario: "delayed" });
    await service.cancel(q.id);
    assert.equal((await service.get(q.id)).state, "cancelled");
    cases.push({ case: "cancel", state: "cancelled", artifact: (await service.get(q.id)).artifact });
    assert.throws(() => new BrowserReplay({ launcher, replicaUrl: "https://untrusted.example", allowedOrigin: origin }), { code: "UNSAFE_DESTINATION" });
    assert.throws(() => new BrowserReplay({ launcher, replicaUrl: origin + "/replica?path=/etc/passwd", allowedOrigin: origin }), { code: "UNSAFE_DESTINATION" });

    // Real operator console, with run router live and ticket/PUT/intake transport-only spies.
    browser = await launcher.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.goto(origin + "/acquisition");
    const first = (await service.list(0, 50)).items.find(r => r.state === "verified")!;
    await page.getByTestId(`button-download-${first.id}`).waitFor();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId(`button-download-${first.id}`).click();
    const d = await downloadPromise;
    await d.saveAs(path.join(temp, "operator.csv"));
    assert.equal(sha256(await readFile(path.join(temp, "operator.csv"))), first.artifact!.checksum);
    await page.getByTestId(`button-intake-${first.id}`).click();
    await page.getByTestId("status-intake").waitFor();
    assert.deepEqual(intakes[0], { sourceId: "upright", reportType: "paid_order_items", period: first.request.period, inputKind: "run", inputId: first.id });
    await page.reload();
    await page.getByTestId(`state-run-${first.id}`).waitFor();
    assert.equal(await page.getByTestId(`state-run-${first.id}`).innerText(), "verified");
    await page.getByTestId("select-manual-dataset").selectOption("upright-items");
    const manual = generateReport(request.period, fixture);
    await page.getByTestId("input-manual-start").fill(request.period.startDate);
    await page.getByTestId("input-manual-end").fill(request.period.endDate);
    await page.getByTestId("input-manual-file").setInputFiles({ name: manual.filename, mimeType: "text/csv", buffer: Buffer.from(manual.csv) });
    await page.getByTestId("button-manual-submit").click();
    await page.getByTestId("status-intake").waitFor();
    assert.equal(uploads.size, 1);
    assert.ok(uploads.get("test-upload-1")!.bytes, await page.getByTestId("status-intake").innerText());
    assert.equal(sha256(uploads.get("test-upload-1")!.bytes!), manual.checksum);
    assert.deepEqual(intakes[1], { sourceId: "upright", reportType: "paid_order_items", period: request.period, inputKind: "upload", inputId: "test-upload-1" });
    await page.getByTestId("input-manual-file").setInputFiles({ name: "unsupported.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("not-csv") });
    await page.getByTestId("button-manual-submit").click();
    await page.getByTestId("status-intake").filter({ hasText: "Only approved" }).waitFor();
    assert.equal(uploads.size, 1); assert.equal(intakes.length, 2);
    cases.push({ case: "manual-upload", bytes: Buffer.byteLength(manual.csv), checksum: manual.checksum,
      matched: true, unsupportedFormatRejectedBeforeTicket: true, intakeContract: intakes[1], limitation: "Data intake is a transport spy, not financial acceptance." });
    assert.deepEqual(errors, []);
    await page.goto(origin + "/replica");
    await page.getByTestId("replica-channel").selectOption("online");
    await page.getByTestId("replica-generate").click();
    assert.equal(await page.getByTestId("replica-error").getAttribute("data-code"), "INVALID_FILTER");
    assert.equal(await page.getByTestId("replica-download").count(), 0);
    cases.push({ case: "unsupported-filter", expectedCode: "INVALID_FILTER", actualCode: "INVALID_FILTER" });
    await context.close();
    const after = lastGoodUrl ? await (await fetch(lastGoodUrl)).text() : null;
    assert.equal(after, before);
    await writeFile(path.join(evidenceDir, "browser-checks.json"), JSON.stringify({
      synthetic: true, realBrowser: true, elapsedMs: Date.now() - started, cases,
      lastGoodChecked: !!lastGoodUrl, lastGoodUnchanged: !!lastGoodUrl && before === after,
      limitations: ["Test-only archive/repository for browser harness; real Postgres separately tested with connection-local temporary table.",
        "Manual intake transport spy; data-lane parser and production App Storage remain integration gates.",
        "No live Upright compatibility or measured partner time savings."],
    }, null, 2) + "\n");
  } finally {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(temp, { recursive: true, force: true });
  }
});