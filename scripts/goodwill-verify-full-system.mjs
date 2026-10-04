import { mkdtemp, rm, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { build } = await import(pathToFileURL(path.join(root, 'artifacts/api-server/node_modules/esbuild/lib/main.js')).href);
const out = await mkdtemp(path.join(tmpdir(), 'goodwill-full-system-'));
try {
  const library = process.env.GOODWILL_PLAYWRIGHT_MODULE ?? path.join(root, 'node_modules/.pnpm',
    (await readdir(path.join(root, 'node_modules/.pnpm'))).find(n => /^playwright@/.test(n)) ?? 'MISSING_PLAYWRIGHT',
    'node_modules/playwright/index.mjs');
  await access(library);
  const chromium = process.env.GOODWILL_CHROMIUM ?? spawnSync('which', ['chromium'], { encoding: 'utf8' }).stdout.trim();
  if (!chromium) throw new Error('Existing system Chromium required; this test installs nothing.');
  await access(chromium);
  await build({
    absWorkingDir: root, entryPoints: ['artifacts/goodwill/src/features/reporting-tests/full-system-entry.tsx'],
    bundle: true, platform: 'browser', format: 'esm', outdir: out, jsx: 'automatic',
    define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'false' },
    alias: { '@': path.join(root, 'artifacts/goodwill/src') },
  });
  await build({
    absWorkingDir: root, entryPoints: ['artifacts/goodwill/src/features/reporting-tests/full-system-browser.test.ts'],
    bundle: true, platform: 'node', format: 'esm', outdir: out, outExtension: { '.js': '.mjs' },
    banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
  });
  const result = spawnSync(process.execPath, ['--test', path.join(out, 'full-system-browser.test.mjs')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, GOODWILL_FULL_SYSTEM_BUILD: out, GOODWILL_PLAYWRIGHT_MODULE: library, GOODWILL_CHROMIUM: chromium },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { await rm(out, { recursive: true, force: true }); }