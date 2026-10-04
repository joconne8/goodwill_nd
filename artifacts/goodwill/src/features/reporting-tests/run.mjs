import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const { build } = await import(pathToFileURL(path.join(root, 'artifacts/api-server/node_modules/esbuild/lib/main.js')).href);
const out = await mkdtemp(path.join(tmpdir(), 'goodwill-reporting-tests-'));
const entries = ['model.test.ts', ...(process.argv.includes('--unit') ? [] : ['browser.test.ts'])];
try {
  await build({
    absWorkingDir: root, entryPoints: entries.map(name => `artifacts/goodwill/src/features/reporting-tests/${name}`),
    bundle: true, platform: 'node', format: 'esm', outdir: out, outExtension: { '.js': '.mjs' },
    banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const result = spawnSync(process.execPath, ['--test', ...entries.map(name => path.join(out, name.replace('.ts', '.mjs')))], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }