import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const out = await mkdtemp(path.join(tmpdir(), "goodwill-acquisition-tests-"));
const unit = process.argv.includes("--unit");
const integration = ["experimental-integration.test.ts", "experimental-integration-postgres.test.ts", "experimental-local-replica.test.ts",
  ...unit ? [] : ["experimental-integration-browser.test.ts"]];
const entries = process.argv.includes("--experimental") ? ["experimental.test.ts", ...integration,
  ...unit ? [] : ["experimental-browser.test.ts"]] :
  ["core.test.ts", "postgres.test.ts", "experimental.test.ts", ...integration, ...unit ? [] : ["browser.test.ts", "experimental-browser.test.ts"]];
try {
  const playwright = pathToFileURL(path.resolve(root, "artifacts/api-server/node_modules/playwright/index.mjs")).href;
  await build({ absWorkingDir: root, entryPoints: entries.map(n => `artifacts/api-server/tests/acquisition/${n}`),
    bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    external: ["esbuild"], plugins: [{
      name: "installed-playwright-runtime",
      setup(builder) {
        // The runtime adapter has a static Playwright import. Keep the actual
        // installed module intact (its runtime assets cannot be bundled), while
        // giving /tmp tests an absolute reviewed module identity.
        builder.onResolve({ filter: /^playwright$/ }, () => ({ path: playwright, external: true }));
      },
    }] });
  // esbuild is used only by the browser test to prepare its isolated frontend.
  const module = pathToFileURL(path.resolve(root, "artifacts/api-server/node_modules/esbuild/lib/main.js")).href;
  // Bundles execute under /tmp, where bare package imports cannot resolve the
  // workspace installation. Resolve trusted installed modules before spawning.
  // Each browser suite launches Chromium. Run suites serially so CPU contention
  // cannot consume the unchanged bounded acquisition waits on shared runners.
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...entries.map(n => path.join(out, n.replace(".ts", ".mjs")))],
    { cwd: root, stdio: "inherit", env: { ...process.env,
      GOODWILL_ESBUILD_MODULE: process.env.GOODWILL_ESBUILD_MODULE ?? module,
      GOODWILL_PLAYWRIGHT_MODULE: process.env.GOODWILL_PLAYWRIGHT_MODULE ?? playwright } });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }