import {build} from "esbuild";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../.."),out=await mkdtemp(path.join(tmpdir(),"goodwill-data-tests-"));
const entries=["core.test.ts","publication-safety.test.ts","postgres.test.ts"];
try {
  await build({absWorkingDir:root,entryPoints:entries.map(n=>`artifacts/api-server/tests/data/${n}`),bundle:true,platform:"node",format:"esm",outdir:out,
    outExtension:{".js":".mjs"},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
  const result=spawnSync(process.execPath,["--test",...entries.map(n=>path.join(out,n.replace(".ts",".mjs")))],{cwd:root,stdio:"inherit"});
  if(result.error) throw result.error; process.exitCode=result.status??1;
} finally {await rm(out,{recursive:true,force:true});}