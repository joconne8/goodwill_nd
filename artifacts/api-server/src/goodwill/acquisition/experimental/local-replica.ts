import express, { type ErrorRequestHandler } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AcquisitionError } from "../contracts";
import type { BrowserLauncher } from "../browser";
import { generateReport, ReportError, validatePeriod } from "../../../lib/goodwill";
import type { ExperimentalAcquisitionRouterOptions } from "./router";

export interface LocalSyntheticReplicaOptions {
  launcher: BrowserLauncher;
  fixture: string;
  /** Trusted packaged bundle, never a request-selected filesystem path.
   * API runtime defaults to dist/acquisition-replica/app.js under its cwd. */
  bundlePath?: string;
}
export interface LocalSyntheticReplica {
  source: NonNullable<ExperimentalAcquisitionRouterOptions["source"]>;
  close(): Promise<void>;
}

/** Private loopback-only synthetic fixture server; NOT an auth bypass for the
 * operator API. This server exposes no operator/data/provider endpoints. */
export async function createLocalSyntheticReplica(options: LocalSyntheticReplicaOptions): Promise<LocalSyntheticReplica> {
  const bundle = await readFile(options.bundlePath ?? path.resolve(process.cwd(), "dist/acquisition-replica/app.js")).catch(() => {
    throw new AcquisitionError("REPLICA_BUNDLE_UNAVAILABLE", "Build the packaged synthetic replica before provisioning its loopback source.", false,
      "Run the existing API build or provide its trusted bundle path.", 503);
  });
  if (!bundle.length || bundle.length > 2 * 1024 * 1024)
    throw new AcquisitionError("REPLICA_BUNDLE_INVALID", "Packaged synthetic replica bundle is missing or exceeds the reviewed limit.", false, "Build the packaged synthetic source.", 503);
  // Validate the existing generator/fixture before opening a listener. No
  // alternate parser, financial calculation, intake, publication or model call.
  generateReport({ startDate: "2026-08-01", endDate: "2026-08-31" }, options.fixture);
  const app = express();
  app.disable("x-powered-by");
  app.enable("case sensitive routing");
  app.enable("strict routing");
  let origin = "", host = "";
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (req.socket.remoteAddress !== "127.0.0.1" || req.headers.host !== host ||
        (req.headers.origin !== undefined && req.headers.origin !== origin) ||
        (req.headers["sec-fetch-site"] !== undefined && !["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])))) {
      res.status(403).json({ code: "REPLICA_ORIGIN_REJECTED", error: "The synthetic source requires its exact loopback host and same origin." });
      return;
    }
    // Compare raw request target, rejecting normalization/traversal/case drift
    // and every query except the baseline's fixed success scenario.
    const allowed = req.method === "GET" && ["/replica/upright", "/replica/upright?scenario=success", "/app.js"].includes(req.originalUrl) ||
      req.method === "POST" && req.originalUrl === "/api/goodwill/report";
    if (!allowed) { res.status(404).json({ code: "REPLICA_ROUTE_REJECTED", error: "Only fixed synthetic source routes are available." }); return; }
    if (req.method === "POST" && req.headers.origin !== origin) {
      res.status(403).json({ code: "REPLICA_ORIGIN_REQUIRED", error: "Synthetic generation requires the same-origin browser request." }); return;
    }
    next();
  });
  app.get("/replica/upright", (_req, res) => res.type("html").send(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Upright acquisition replica</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>'));
  app.get("/app.js", (_req, res) => res.type("application/javascript").send(bundle));
  app.post("/api/goodwill/report", express.json({ limit: "1kb", strict: true, type: "application/json", inflate: false }), (req, res) => {
    try {
      if (!req.is("application/json") || !req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
          Object.keys(req.body).some(key => !["startDate", "endDate"].includes(key)))
        throw new ReportError("INVALID_PERIOD", "Only the frozen synthetic startDate and endDate are accepted.");
      const period = validatePeriod(req.body);
      res.json(generateReport(period, options.fixture));
    } catch (e) {
      res.status(e instanceof ReportError ? 400 : 503).json({
        code: e instanceof ReportError ? e.code : "REPLICA_GENERATION_UNAVAILABLE",
        error: e instanceof ReportError ? e.message : "Synthetic generation is unavailable.",
      });
    }
  });
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.type === "entity.too.large" ? 413 : error?.status === 415 ? 415 : 400;
    res.status(status).json({ code: "REPLICA_PAYLOAD_REJECTED", error: "Use a small uncompressed JSON synthetic period." });
  };
  app.use(errors);
  const server = app.listen(0, "127.0.0.1");
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", () => { server.off("error", reject); resolve(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new AcquisitionError("REPLICA_LISTENER_UNAVAILABLE", "Synthetic loopback listener did not open.", false, "Check listener availability.", 503);
  }
  host = `127.0.0.1:${address.port}`; origin = `http://${host}`;
  let closing: Promise<void> | undefined;
  return {
    source: { launcher: options.launcher, fixture: options.fixture, replicaUrl: origin + "/replica/upright",
      allowedOrigin: origin, allowedAssetPaths: ["/app.js"] },
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeIdleConnections();
      });
      return closing;
    },
  };
}