// Compare the independent Decimal oracle with injected feature-service results.
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await mkdtemp(path.join(tmpdir(), "goodwill-independent-service-"));
try {
  const {build} = await import(pathToFileURL(path.join(root, "artifacts/api-server/node_modules/esbuild/lib/main.js")).href);
  const entry = "docs/goodwill/verification/independent/service-output-check.test.ts";
  await build({
    absWorkingDir: root, entryPoints: [entry], bundle: true, platform: "node", format: "esm",
    outfile: path.join(out, "service-check.mjs"),
    banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"},
  });
  const result = spawnSync(process.execPath, ["--test", path.join(out, "service-check.mjs")], {
    cwd: root, stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(out, {recursive: true, force: true});
}