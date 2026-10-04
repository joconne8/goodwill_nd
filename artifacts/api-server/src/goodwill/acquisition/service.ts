import { randomUUID } from "node:crypto";
import { StartGoodwillRunBody } from "@workspace/api-zod";
import { validatePeriod, ReportError } from "../../lib/goodwill";
import { AcquisitionError, aborted, terminal, type Run, type RunRepository, type Replay, type Archive, type Request } from "./contracts";
import { isTimestamp, sha256, verifyDownload } from "./verify";

export class AcquisitionService {
  private controllers = new Map<string, AbortController>();
  private ready = false;
  constructor(private deps: {
    repository: RunRepository; archive: Archive; replay: Replay; fixture: string;
    timeoutMs?: number; now?: () => string;
  }) {}
  private now() { return this.deps.now?.() ?? new Date().toISOString(); }
  /** Single worker process; lead must stop its predecessor before initialization. */
  async initialize() {
    await this.deps.repository.interruptUnfinished(this.now());
    this.ready = true;
  }
  /** Optional Replay is trusted server injection only; never accepted from the wire request. */
  async start(input: unknown, replay: Replay = this.deps.replay): Promise<Run> {
    if (!this.ready) throw new AcquisitionError("NOT_INITIALIZED", "Run repository is not initialized.", false, "Initialize the acquisition worker.", 503);
    const parsed = StartGoodwillRunBody.safeParse(input);
    if (!parsed.success) throw new AcquisitionError("INVALID_REQUEST", "Use the frozen Upright acquisition request; arbitrary browser URLs are not accepted.");
    // Generated Zod schemas may strip unknown properties; reject them explicitly.
    if (!input || Object.keys(input).some(k => !["sourceId", "reportType", "period", "scenario", "retryOf"].includes(k)))
      throw new AcquisitionError("INVALID_REQUEST", "Unknown acquisition parameters are not allowed.");
    const request = parsed.data as Request;
    if (Object.keys((input as { period: object }).period).some(k => !["startDate", "endDate"].includes(k)))
      throw new AcquisitionError("INVALID_REQUEST", "Period accepts startDate and endDate only.");
    validatePeriod(request.period);
    let attempt = 1;
    if (request.retryOf) {
      const previous = await this.get(request.retryOf);
      if (!["failed", "cancelled"].includes(previous.state) || previous.attempt !== 1 ||
          previous.request.sourceId !== request.sourceId || previous.request.reportType !== request.reportType ||
          JSON.stringify(previous.request.period) !== JSON.stringify(request.period))
        throw new AcquisitionError("RETRY_NOT_ALLOWED", "Retry requires a failed/cancelled first attempt with the same period.", false, "Inspect history or start a new independently parameterized run.", 409);
      attempt = 2;
    }
    // Bounded active work; no automatic retry or unattended scheduler.
    if (this.controllers.size >= 4) throw new AcquisitionError("WORKER_BUSY", "Four runs are already active.", true, "Wait or cancel an active run.", 409);
    const at = this.now();
    const run: Run = { id: randomUUID(), request, state: "queued", createdAt: at, updatedAt: at,
      attempt, lastStep: "queued", steps: [{ name: "queued", at }], artifact: null, failure: null, contractVersion: "2.0.0" };
    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    try { await this.deps.repository.create(run); }
    catch (e) { this.controllers.delete(run.id); throw e; }
    // Reply with immutable queued state; processing never implies publication.
    queueMicrotask(() => { void this.execute(run.id, controller, replay).catch(() => {
      // A persistence outage is not fake failure evidence; recovery on restart marks unfinished runs.
      controller.abort();
    }); });
    return structuredClone(run);
  }
  async get(id: string) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new AcquisitionError("NOT_FOUND", "Unknown run.", false, "Refresh run history.", 404);
    const run = await this.deps.repository.get(id);
    if (!run) throw new AcquisitionError("NOT_FOUND", "Unknown run.", false, "Refresh run history.", 404);
    return run;
  }
  list(offset: number, limit: number) { return this.deps.repository.list(offset, limit); }
  async cancel(id: string) {
    for (let i = 0; i < 3; i++) {
      const run = await this.get(id);
      if (terminal(run.state)) return run;
      const cancelled: Run = { ...run, state: "cancelled", updatedAt: this.now(), artifact: null,
        failure: new AcquisitionError("CANCELLED", "Operator cancelled this run.", false, "Retry once or use manual upload.").toFailure() };
      if (await this.deps.repository.replace(cancelled, [run.state])) {
        this.controllers.get(id)?.abort();
        return cancelled;
      }
    }
    throw new AcquisitionError("STATE_CONFLICT", "Run changed while cancelling.", true, "Refresh and cancel again.", 409);
  }
  private async execute(id: string, controller: AbortController, replay: Replay) {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, Math.min(this.deps.timeoutMs ?? 60000, 60000));
    const step = async (name: string) => {
      aborted(controller.signal);
      const run = await this.get(id);
      if (terminal(run.state)) throw new AcquisitionError("CANCELLED", "Run is no longer active.");
      const at = this.now();
      if (!await this.deps.repository.replace({ ...run, state: name === "downloaded" ? "downloaded" : run.state === "queued" ? "running" : run.state,
        steps: [...run.steps ?? [], { name, at }],
        lastStep: name, updatedAt: at }, [run.state]))
        throw new AcquisitionError("CANCELLED", "Run changed during replay.");
    };
    try {
      const initial = await this.get(id);
      if (terminal(initial.state)) return;
      await step("browser_start");
      // Even a faulty injected replay cannot escape the outer wall-clock bound.
      const abortPromise = new Promise<never>((_, reject) => {
        const stop = () => reject(new AcquisitionError("CANCELLED", "Replay stopped."));
        if (controller.signal.aborted) stop();
        else controller.signal.addEventListener("abort", stop, { once: true });
      });
      const evidence = await Promise.race([replay.acquire(initial.request, controller.signal, step), abortPromise]);
      await step("downloaded");
      const downloaded = await this.get(id);
      if (downloaded.state !== "downloaded") return;
      const manifest = verifyDownload(initial.request, evidence, this.deps.fixture);
      if (!await this.deps.repository.replace({ ...downloaded, downloadedAt: evidence.downloadedAt }, ["downloaded"])) return;
      await step("bytes_verified");
      const artifact = await Promise.race([this.deps.archive.put(id, evidence.bytes,
        { filename: manifest.filename, checksum: manifest.checksum }), abortPromise]);
      aborted(controller.signal);
      if (artifact.checksum !== manifest.checksum || artifact.byteSize !== evidence.bytes.length ||
          artifact.filename !== manifest.filename || artifact.synthetic !== true ||
          !isTimestamp(artifact.archivedAt) ||
          !/^[a-zA-Z0-9_-]{1,160}$/.test(artifact.artifactId))
        throw new AcquisitionError("ARCHIVE_IDENTITY_MISMATCH", "Private archive did not retain verified file identity.", false, "Review the archive adapter.");
      const run = await this.get(id);
      if (run.state !== "downloaded") return;
      const cleanArtifact = { artifactId: artifact.artifactId, filename: artifact.filename, checksum: artifact.checksum,
        byteSize: artifact.byteSize, archivedAt: artifact.archivedAt, synthetic: true as const };
      await this.deps.repository.replace({ ...run, state: "verified", artifact: cleanArtifact, failure: null,
        lastStep: "archived_verified_file", updatedAt: this.now() }, ["downloaded"]);
    } catch (e) {
      const run = await this.get(id);
      if (terminal(run.state)) return;
      const error = timedOut ? new AcquisitionError("RUN_TIMEOUT", "Acquisition exceeded its bounded wait.", true, "Retry once or use manual CSV upload.")
        : e instanceof AcquisitionError ? e
        : e instanceof ReportError ? new AcquisitionError(e.code, e.message)
        : new AcquisitionError("ACQUISITION_UNAVAILABLE", "Browser, archive or run storage could not complete acquisition.", true, "Inspect service health; retry once or use manual upload.", 503);
      await this.deps.repository.replace({ ...run, state: "failed", artifact: null,
        updatedAt: this.now(), failure: error.toFailure() }, [run.state]);
    } finally { clearTimeout(timer); this.controllers.delete(id); }
  }
  /** Common data intake resolves this server-issued run ID, not a client path. */
  async resolveVerifiedRun(id: string) {
    const run = await this.get(id);
    if (run.state !== "verified" || !run.artifact)
      throw new AcquisitionError("RUN_NOT_VERIFIED", "Only a verified run can enter intake.", false, "Complete acquisition or use manual upload.", 409);
    const bytes = await this.deps.archive.read(run.artifact.artifactId);
    if (bytes.length !== run.artifact.byteSize || sha256(bytes) !== run.artifact.checksum)
      throw new AcquisitionError("ARCHIVE_CHECKSUM_MISMATCH", "Stored bytes changed after acquisition.", false, "Quarantine the object and review storage integrity.", 409);
    return { run, bytes, artifact: run.artifact, manifest: Object.freeze({
      runId: run.id, sourceId: run.request.sourceId, reportType: run.request.reportType,
      ...run.request.period, timezone: "America/New_York" as const, synthetic: true as const,
      acquisitionVersion: "2.0.0", filename: run.artifact.filename, checksum: run.artifact.checksum,
      byteSize: run.artifact.byteSize, downloadedAt: run.downloadedAt ?? run.updatedAt, artifactId: run.artifact.artifactId,
    }) };
  }
}