// Test auth freshness/capability semantics and source-scope guards in isolation.
import {copyFile, mkdtemp, rm, symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await mkdtemp(path.join(tmpdir(), "goodwill-independent-access-"));
try {
  const {build} = await import(pathToFileURL(path.join(root, "artifacts/api-server/node_modules/esbuild/lib/main.js")).href);
  await symlink(path.join(root, "artifacts/api-server/node_modules"), path.join(out, "node_modules"));
  const entries = [
    ["artifacts/api-server/src/goodwill/operatorPolicy.ts", "operator-policy.mjs"],
    ["artifacts/api-server/src/goodwill/operatorAuth.ts", "operator-auth.mjs"],
    ["artifacts/api-server/src/goodwill/replicaCapability.ts", "replica-capability.mjs"],
    ["artifacts/api-server/src/goodwill/replicaDestination.ts", "replica-destination.mjs"],
  ];
  for (const [entry, filename] of entries) {
    await build({
      absWorkingDir: root, entryPoints: [entry], bundle: true, platform: "node", format: "esm",
      outfile: path.join(out, filename),
      ...(filename === "operator-auth.mjs" ? {external: ["@clerk/express"]} : {}),
    });
  }
  const testFile = path.join(out, "access-security.test.mjs");
  await copyFile(path.join(root, "docs/goodwill/verification/independent/access-security.test.mjs"), testFile);
  const result = spawnSync(process.execPath, ["--experimental-test-module-mocks", "--test",
    testFile], {
    cwd: out,
    env: {
      ...process.env,
      GOODWILL_QA_ROOT: root,
      GOODWILL_QA_POLICY_MODULE: path.join(out, "operator-policy.mjs"),
      GOODWILL_QA_OPERATOR_AUTH_MODULE: path.join(out, "operator-auth.mjs"),
      GOODWILL_QA_CAPABILITY_MODULE: path.join(out, "replica-capability.mjs"),
      GOODWILL_QA_REPLICA_DESTINATION_MODULE: path.join(out, "replica-destination.mjs"),
      // Synthetic test-only identity. No configured or partner address is read.
      GOODWILL_DEMO_OPERATOR_EMAIL: "approved@demo.invalid",
      GOODWILL_REPLICA_URL: "https://replica.demo.invalid/replica/upright",
      NODE_ENV: "production",
    },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(out, {recursive: true, force: true});
}