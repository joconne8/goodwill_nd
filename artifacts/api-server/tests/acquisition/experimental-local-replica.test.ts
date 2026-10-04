import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { request as httpRequest } from "node:http";
import { createLocalSyntheticReplica } from "../../src/goodwill/acquisition/experimental/local-replica";
import { fixture, request } from "./helpers";
import { generateReport } from "../../src/lib/goodwill";

test("private synthetic listener serves only exact routes and rejects host/origin/path/period/payload drift", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "replica-source-"));
  const bundlePath = path.join(temp, "app.js");
  await writeFile(bundlePath, "// TEST asset only; real entry is exercised by browser integration\n");
  const local = await createLocalSyntheticReplica({ fixture, bundlePath,
    launcher: { async launch(): Promise<never> { throw new Error("HTTP test must not launch"); } } });
  const origin = local.source.allowedOrigin;
  try {
    assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(local.source.replicaUrl, origin + "/replica/upright");
    assert.deepEqual(local.source.allowedAssetPaths, ["/app.js"]);
    const page = await fetch(local.source.replicaUrl);
    assert.equal(page.status, 200); assert.equal(page.headers.get("cache-control"), "no-store");
    assert.match(await page.text(), /script src="\/app.js"/);
    assert.equal((await fetch(local.source.replicaUrl + "?scenario=success")).status, 200);
    assert.equal((await fetch(origin + "/app.js")).status, 200);
    for (const suffix of ["/", "/replica/upright/", "/replica/Upright", "/replica/upright?scenario=dom_drift",
      "/replica/upright?url=https://example.invalid", "/app.js?x=1", "/api/goodwill/report?x=1", "/etc/passwd"])
      assert.equal((await fetch(origin + suffix)).status, 404);
    assert.equal((await fetch(local.source.replicaUrl, { headers: { Origin: "https://foreign.invalid" } })).status, 403);
    // Node fetch can replace Host/fetch-metadata headers; use an actual raw
    // request target/header on the wire to test spoofing and path normalization.
    const rawStatus = (target: string, headers: Record<string, string>) => new Promise<number>((resolve, reject) => {
      const req = httpRequest(origin, { path: target, headers },
        res => { res.resume(); resolve(res.statusCode!); });
      req.once("error", reject); req.end();
    });
    assert.equal(await rawStatus("/replica/upright", { Host: "foreign.invalid" }), 403);
    assert.equal(await rawStatus("/replica/upright", { Host: new URL(origin).host, "Sec-Fetch-Site": "cross-site" }), 403);
    const traversed = await rawStatus("/replica/../app.js", { Host: new URL(origin).host });
    assert.equal(traversed, 404);
    const post = (body: unknown, headers: Record<string, string> = { Origin: origin }) =>
      fetch(origin + "/api/goodwill/report", { method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body) });
    const report = await post(request.period);
    assert.equal(report.status, 200); assert.deepEqual(await report.json(), generateReport(request.period, fixture));
    assert.equal((await post(request.period, {})).status, 403);
    assert.equal((await post(request.period, { Origin: "null" })).status, 403);
    for (const body of [
      { ...request.period, sourceId: "live" }, { ...request.period, fixture: "fake" }, { startDate: "bad", endDate: "bad" },
      { startDate: "2026-08-31", endDate: "2026-08-01" }, { startDate: "2026-09-01", endDate: "2026-09-02" }, [], null,
    ]) assert.equal((await post(body)).status, 400);
    assert.equal((await post({ ...request.period, extra: "a".repeat(2048) })).status, 413);
    assert.equal((await fetch(origin + "/api/goodwill/report", { method: "POST", headers: { Origin: origin,
      "Content-Type": "application/json" }, body: "{" })).status, 400);
    assert.equal((await fetch(origin + "/api/goodwill/report", { method: "POST", headers: { Origin: origin,
      "Content-Type": "text/plain" }, body: JSON.stringify(request.period) })).status, 400);
    assert.equal((await fetch(origin + "/api/goodwill/report", { method: "GET" })).status, 404);
    assert.equal((await fetch(origin + "/app.js", { method: "HEAD" })).status, 404);
    await local.close(); await local.close();
  } finally { await local.close(); await rm(temp, { recursive: true, force: true }); }
});