import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const out = await mkdtemp(path.join(tmpdir(), "goodwill-acquisition-tests-"));
const unit = process.argv.includes("--unit");
const entries = ["core.test.ts", "postgres.test.ts", ...unit ? [] : ["browser.test.ts"]];
try {
  await build({ absWorkingDir: root, entryPoints: entries.map(n => `artifacts/api-server/tests/acquisition/${n}`),
    bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" },
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    external: ["esbuild"] });
  // esbuild is used only by the browser test to prepare its isolated frontend.
  const module = path.resolve(root, "artifacts/api-server/node_modules/esbuild/lib/main.js");
  const result = spawnSync(process.execPath, ["--test", ...entries.map(n => path.join(out, n.replace(".ts", ".mjs")))],
    { cwd: root, stdio: "inherit", env: { ...process.env, GOODWILL_ESBUILD_MODULE: module } });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }