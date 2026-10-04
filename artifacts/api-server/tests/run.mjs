import { build } from "esbuild";
import { readdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const output = await mkdtemp(path.join(os.tmpdir(), "goodwill-tests-"));
try {
  const entries = (await readdir("tests")).filter(name => name.endsWith(".test.ts"));
  if (!entries.length) throw new Error("No API tests found");
  await build({
    entryPoints: entries.map(name => `tests/${name}`), bundle: true,
    platform: "node", format: "esm", outdir: output, outExtension: { ".js": ".mjs" },
  });
  const result = spawnSync(process.execPath, ["--test", ...entries.map(name => path.join(output, name.replace(/\.ts$/, ".mjs")))], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(output, { recursive: true, force: true });
}