import {build} from "esbuild";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const out=await mkdtemp(path.join(tmpdir(),"goodwill-analytics-tests-"));
const live=process.argv.includes("--live-readonly");
const exportIndex=process.argv.indexOf("--export-snapshot");
const exportSnapshot=exportIndex>=0;
const entry=exportSnapshot?"export-local-snapshot":live?"live-readonly":"analytics.test";
try {
  await build({absWorkingDir:root,entryPoints:[`artifacts/api-server/tests/analytics/${entry}.ts`],
    bundle:true,platform:"node",format:"esm",outdir:out,outExtension:{".js":".mjs"},
    banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
  const runnerArgs=exportSnapshot?[path.join(out,`${entry}.mjs`),process.argv[exportIndex+1]]:live?[path.join(out,`${entry}.mjs`)]:["--test",path.join(out,`${entry}.mjs`)];
  const r=spawnSync(process.execPath,runnerArgs,{cwd:root,stdio:"inherit"});
  if(r.error)throw r.error;process.exitCode=r.status??1;
}finally{await rm(out,{recursive:true,force:true});}