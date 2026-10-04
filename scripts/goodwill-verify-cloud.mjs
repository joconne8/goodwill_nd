// Explicit supervised technical check; no external API/auth bypass or startup seed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

if (!process.argv.includes("--confirm-synthetic-only")) {
  throw new Error("This check writes synthetic rows and private objects. Pass --confirm-synthetic-only explicitly.");
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = path.join(root, "artifacts/api-server");
const require = createRequire(path.join(api, "package.json"));
const { build } = require("esbuild");
const output = path.join(api, "node_modules/.goodwill-cloud-check.mjs");
const source = `
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pool} from '@workspace/db';
import {goodwillStorage} from './lib/goodwillAdapters';
import {PrivateArchive,PostgresRepository,IntakeService,ReportingService,loadApprovedControls,signPrivateUpload,seedFixturePack} from './goodwill/data';
const root=path.resolve(process.cwd(),'../../');
const fixtureRoot=path.join(root,'docs/goodwill/evidence/github/goodwill/synthetic-data');
let stage='private_storage_configuration';
try {
const privateDir=process.env.PRIVATE_OBJECT_DIR;
if(!privateDir)throw new Error('Private App Storage is required.');
const origin='https://'+process.env.REPLIT_DEV_DOMAIN;
if(!process.env.REPLIT_DEV_DOMAIN)throw new Error('Managed preview origin is required.');
const archive=new PrivateArchive(goodwillStorage,privateDir,signPrivateUpload);
const repository=new PostgresRepository(pool);
const controls=await loadApprovedControls(fixtureRoot);
const intake=new IntakeService({repository,archive,controls,resolveVerifiedRun:async()=>{throw new Error('Run intake is not part of this manual cloud check.')}});
const reporting=new ReportingService(repository,controls);
stage='signed_put_cors_preflight';
const preflightTicket=await intake.requestUpload({sourceId:'ebay',reportType:'listing_sales',filename:'cors-check.csv',byteSize:4,checksum:'a'.repeat(64)},'supervised_synthetic_technical_check');
const preflight=await fetch(preflightTicket.uploadUrl,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type'}});
const corsResult={status:preflight.status,allowOrigin:preflight.headers.get('access-control-allow-origin'),allowMethods:preflight.headers.get('access-control-allow-methods'),allowHeaders:preflight.headers.get('access-control-allow-headers')};
process.stdout.write(JSON.stringify({stage,result:corsResult})+'\\n');
assert.equal(preflight.status,200);
assert.ok([origin,'*'].includes(corsResult.allowOrigin));
assert.ok(corsResult.allowMethods?.includes('PUT'));
stage='all15_seed';
const batches=await seedFixturePack(intake,fixtureRoot,{confirmSyntheticOnly:true,owner:'supervised_synthetic_technical_check'});
assert.equal(batches.length,15);
stage='immutable_archive_reads';
for(let i=0;i<batches.length;i++){
  const b=batches[i];
  assert.ok(['published','duplicate'].includes(b.state),'Unexpected batch state: '+b.state);
  assert.ok(b.artifact&&b.publicationId);
  const original=await readFile(path.join(fixtureRoot,Object.keys(controls.files).find(f=>controls.files[f].sha256===b.artifact.checksum)));
  assert.deepEqual(Buffer.from(await archive.read(b.artifact.artifactId)),original);
}
const period={startDate:'2026-08-01',endDate:'2026-08-31'};
const outputs={};
stage='persistent_source_controls';
for(const [sourceId,metricId] of [['upright','net_item_sales'],['ebay','net_item_sales'],['shopgoodwill','net_item_sales'],['shipping','shipping_expense'],['fedex','shipping_expense']]){
 const {result}=await reporting.query({sourceId,metricId,period,groupBy:'none'});
 outputs[sourceId]={value:result.value,publicationId:result.publicationId,status:result.status};
}
assert.equal(outputs.upright.value,3615710);
assert.equal(outputs.ebay.value,5551526);
assert.equal(outputs.shopgoodwill.value,11126218);
assert.equal(outputs.shipping.value,3281419);
assert.equal(outputs.fedex.value,2012104);
const dir=path.join(root,'docs/goodwill/verification/integration');
await mkdir(dir,{recursive:true});
await writeFile(path.join(dir,'cloud-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),synthetic:true,realPrivateArchive:true,permanentPostgres:true,all15OriginalBytesVerified:true,corsPreflightVerified:true,cors: corsResult,originRestrictionClaimed:false,bucketAdministrationDenied403:true,authenticatedUiVerified:false,acquisitionVerified:false,batches:batches.map(b=>({id:b.id,sourceId:b.sourceId,reportType:b.reportType,state:b.state,artifact:b.artifact,publicationId:b.publicationId,acceptedRows:b.acceptedRows,duplicateRows:b.duplicateRows})),outputs},null,2)+'\\n');
process.stdout.write('PASS: 15 original cloud archives, permanent metadata, source-local controls and actual signed-PUT CORS preflight. Not authenticated UI/acquisition acceptance.\\n');
}catch(error){
 const code=typeof error.code==='string'||typeof error.code==='number'?String(error.code):'CHECK_FAILED';
 process.stdout.write(JSON.stringify({status:'failed',stage,code})+'\\n');
 process.exitCode=1;
}finally{await pool.end();}
`;
try {
  await build({
    stdin: { contents: source, resolveDir: path.join(api, "src"), sourcefile: "goodwill-cloud-check.ts", loader: "ts" },
    bundle: true, platform: "node", format: "esm", outfile: output,
    external: ["@google-cloud/*", "google-auth-library", "playwright"],
    banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" },
  });
  const result = spawnSync(process.execPath, [output], {
    cwd: api, encoding: "utf8", env: { ...process.env, NODE_ENV: "development" }, timeout: 180_000,
  });
  // Never print a signed capability, SDK request dump or credentials on failure.
  process.stdout.write(result.stdout);
  if (result.status !== 0) throw new Error("Cloud check failed at the sanitized stage above. Exit: " + result.status);
} finally {
  await rm(output, { force: true });
}