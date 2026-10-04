// Read-only verification of the existing synthetic PostgreSQL dataset.
// Does not start an HTTP server, bypass app authorization, seed data or call a model.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = await mkdtemp(path.join(tmpdir(), "goodwill-full-runtime-"));
try {
  const { build } = await import(pathToFileURL(path.join(root, "artifacts/api-server/node_modules/esbuild/lib/main.js")).href);
  const outfile = path.join(dir, "verify.mjs");
  await build({
    absWorkingDir: root,
    entryPoints: ["scripts/goodwill-verify-full-runtime.ts"],
    outfile, bundle: true, platform: "node", format: "esm",
    banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const result = spawnSync(process.execPath, [outfile], { cwd: root, stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}