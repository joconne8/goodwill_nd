import { build } from "../artifacts/api-server/node_modules/esbuild/lib/main.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const out = await mkdtemp(path.join(tmpdir(), "goodwill-assistant-usage-"));
try {
  const entry = path.join(out, "verify.mjs");
  await build({
    entryPoints: ["scripts/goodwill-verify-assistant-usage.ts"], outfile: entry,
    bundle: true, platform: "node", format: "esm",
    banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
  });
  const run = spawnSync(process.execPath, [entry, ...process.argv.slice(2)], { stdio: "inherit" });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }