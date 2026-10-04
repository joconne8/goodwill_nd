import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AcquisitionError, aborted, type DownloadEvidence, type DownloadManifest, type Replay, type Request, type Step } from "./contracts";
import { MAX_BYTES } from "./verify";

// Structural Playwright boundary keeps shared packages/lockfile lead-owned.
// Inject chromium from the lead-installed Playwright package, never a client executable path.
interface Locator {
  count(): Promise<number>;
  waitFor(options: { state: "attached"; timeout: number }): Promise<void>;
  click(): Promise<void>;
  fill(value: string): Promise<void>;
  selectOption(value: string): Promise<unknown>;
  innerText(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
}
interface Download {
  suggestedFilename(): string;
  saveAs(path: string): Promise<void>;
  failure(): Promise<string | null>;
}
interface Page {
  locator(selector: string): Locator;
  goto(url: string, options: { waitUntil: "domcontentloaded" }): Promise<unknown>;
  waitForEvent(event: "download", options: { timeout: number }): Promise<Download>;
  setDefaultTimeout(ms: number): void;
}
interface Context {
  route(pattern: string, handler: (route: { request(): { url(): string }; continue(): Promise<void>; abort(): Promise<void> }) => Promise<void>): Promise<void>;
  newPage(): Promise<Page>;
  close(): Promise<void>;
}
interface Browser {
  newContext(options: { acceptDownloads: boolean; serviceWorkers: "block" }): Promise<Context>;
  close(): Promise<void>;
}
export interface BrowserLauncher {
  launch(options: { headless: true }): Promise<Browser>;
}
export class BrowserReplay implements Replay {
  private url: URL;
  constructor(private options: {
    launcher: BrowserLauncher; replicaUrl: string; allowedOrigin: string;
    waitMs?: number; testFault?: "wrong_dates" | "failed_download";
  }) {
    const url = new URL(options.replicaUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== options.allowedOrigin ||
        url.username || url.password || url.search || url.hash)
      throw new AcquisitionError("UNSAFE_DESTINATION", "Configure one exact approved replica origin and path.");
    this.url = url;
  }
  async acquire(request: Request, signal: AbortSignal, step: Step): Promise<DownloadEvidence> {
    aborted(signal);
    const waitMs = Math.max(100, Math.min(this.options.waitMs ?? 55000, 55000));
    const deadline = Date.now() + waitMs;
    let browser: Browser | undefined, context: Context | undefined, directory: string | undefined;
    const stop = () => { void context?.close().catch(() => {}); void browser?.close().catch(() => {}); };
    signal.addEventListener("abort", stop, { once: true });
    try {
      browser = await this.options.launcher.launch({ headless: true });
      aborted(signal);
      context = await browser.newContext({ acceptDownloads: true, serviceWorkers: "block" });
      await context.route("**/*", async route => {
        // Includes subresources, XHR and navigations. No remote sessions or arbitrary portals.
        const url = new URL(route.request().url());
        if (url.origin === this.url.origin && ["http:", "https:"].includes(url.protocol)) await route.continue();
        else await route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(Math.min(waitMs, 3000));
      const url = new URL(this.url);
      url.searchParams.set("scenario", this.options.testFault ?? request.scenario);
      await page.goto(url.href, { waitUntil: "domcontentloaded" });
      const locator = (id: string) => page.locator(`[data-testid="${id}"]`);
      // DOMContentLoaded can precede React hydration, especially with Vite.
      await locator("replica-reports").waitFor({ state: "attached", timeout: Math.max(1, deadline - Date.now()) });
      const portalError = async () => {
        const error = locator("replica-error");
        if (await error.count()) {
          const code = await error.getAttribute("data-code") ?? "PORTAL_ERROR";
          const known = ["SESSION_EXPIRED", "MISSING_REPORT", "EMPTY_REPORT", "UNSUPPORTED_PERIOD", "INVALID_PERIOD", "INVALID_FILTER", "DOWNLOAD_FAILED", "WRONG_REPORT_DATES", "INVALID_FILE_SIZE"];
          const safeCode = known.includes(code) ? code : "PORTAL_ERROR";
          throw new AcquisitionError(safeCode, safeCode === "SESSION_EXPIRED" ? "The simulated session expired." : "The synthetic portal stopped before a verified download.",
            ["SESSION_EXPIRED", "MISSING_REPORT", "DOWNLOAD_FAILED"].includes(safeCode),
            safeCode === "SESSION_EXPIRED" ? "Reauthenticate the simulated session, then explicitly retry; no credentials are recorded." : "Inspect the report parameters, retry once or use manual CSV upload.");
        }
      };
      const act = async (id: string, operation: (l: Locator) => Promise<unknown>) => {
        aborted(signal);
        await portalError();
        const l = locator(id);
        if (await l.count() !== 1) throw new AcquisitionError("DOM_DRIFT", "An agreed portal control is missing or ambiguous.", false, "Review the replica controls with the process owner; use manual upload.");
        await operation(l);
        await step(id);
      };
      await act("replica-reports", l => l.click());
      await act("replica-paid-orders", l => l.click());
      await act("replica-start", l => l.fill(request.period.startDate));
      await act("replica-end", l => l.fill(request.period.endDate));
      await act("replica-timezone", l => l.selectOption("America/New_York"));
      await act("replica-channel", l => l.selectOption("all"));
      await act("replica-payment", l => l.selectOption("paid"));
      await act("replica-generate", l => l.click());
      await act("replica-confirm", l => l.click());
      while (!await locator("replica-ready").count()) {
        aborted(signal);
        await portalError();
        if (Date.now() >= deadline) throw new AcquisitionError("REPORT_TIMEOUT", "Report did not become ready within the bounded wait.", true, "Retry once or use a manually downloaded CSV.");
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await step("report_ready");
      const manifestLocator = locator("replica-manifest");
      if (await manifestLocator.count() !== 1) throw new AcquisitionError("DOM_DRIFT", "Frozen report manifest is missing or ambiguous.");
      let manifest: DownloadManifest;
      try { manifest = JSON.parse(await manifestLocator.innerText()); }
      catch { throw new AcquisitionError("INVALID_MANIFEST", "Portal did not provide readable frozen file metadata."); }
      if (await locator("replica-download").count() !== 1) throw new AcquisitionError("DOM_DRIFT", "Download control changed.");
      // Listen BEFORE clicking, then wait for actual browser download completion.
      const downloadPromise = page.waitForEvent("download", { timeout: Math.max(1, deadline - Date.now()) });
      // Attach rejection handler immediately, even if clicking itself fails.
      downloadPromise.catch(() => {});
      await locator("replica-download").click();
      let download: Download;
      try { download = await downloadPromise; }
      catch { throw new AcquisitionError("DOWNLOAD_FAILED", "Browser did not complete a report download.", true, "Retry once or download and upload the CSV manually."); }
      aborted(signal);
      if (await download.failure()) throw new AcquisitionError("DOWNLOAD_FAILED", "The browser reported an unsuccessful download.", true, "Retry once or use manual upload.");
      directory = await mkdtemp(path.join(tmpdir(), "goodwill-download-"));
      // Fixed server-owned destination; never concatenate suggestedFilename or client paths.
      const file = path.join(directory, "report.csv");
      await download.saveAs(file);
      const size = (await stat(file)).size;
      if (!size || size > MAX_BYTES) throw new AcquisitionError("INVALID_FILE_SIZE", "Browser file is empty or too large.");
      const bytes = await readFile(file);
      return { bytes, manifest, suggestedFilename: download.suggestedFilename(), downloadedAt: new Date().toISOString() };
    } catch (e) {
      aborted(signal);
      if (e instanceof AcquisitionError) throw e;
      throw new AcquisitionError("BROWSER_REPLAY_FAILED", "The browser could not complete the agreed replay.", true, "Check browser availability and replica health, then retry once or upload manually.", 503);
    } finally {
      signal.removeEventListener("abort", stop);
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
}