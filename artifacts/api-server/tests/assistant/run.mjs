import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const out = await mkdtemp(path.join(tmpdir(), "goodwill-assistant-tests-"));
try {
  await build({
    absWorkingDir: root, entryPoints: ["artifacts/api-server/tests/assistant/assistant.test.ts", "artifacts/api-server/tests/assistant/provider.test.ts"],
    bundle: true, platform: "node", format: "esm", outdir: out, outExtension: { ".js": ".mjs" },
    banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
  });
  const result = spawnSync(process.execPath, ["--test", path.join(out, "assistant.test.mjs"), path.join(out, "provider.test.mjs")], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }