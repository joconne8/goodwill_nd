import { readFile } from "node:fs/promises";
import path from "node:path";
import { datasets } from "./catalog";
import { hash, instant } from "./normalize";
import { DataError, type Controls } from "./types";
import type { IntakeService } from "./intake";

function object(value:unknown):Record<string,unknown> {
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new DataError("INVALID_CONTROLS","Approved controls must be structured metadata.");
  return value as Record<string,unknown>;
}
/** Trusted, server-configured path ONLY; never expose this function as a client-path HTTP route. */
export async function loadApprovedControls(root:string):Promise<Controls> {
  const manifest=object(JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8")));
  if(manifest.synthetic!==true || manifest.currency!=="USD")throw new DataError("INVALID_CONTROLS","Only approved synthetic USD controls are supported.");
  const controls:Controls={files:{},control_totals:{},inventory_controls:{}};
  for(const [filename,input]of Object.entries(object(manifest.files))) {
    const m=object(input);
    if(!datasets.some(d=>d.filename===filename) || !Number.isSafeInteger(m.rows) || Number(m.rows)<1 || Number(m.rows)>20000 ||
      typeof m.sha256!=="string" || !/^[a-f0-9]{64}$/.test(m.sha256))throw new DataError("INVALID_CONTROLS","Invalid fixture identity control.");
    controls.files[filename]={rows:Number(m.rows),sha256:m.sha256};
  }
  for(const [filename,input]of Object.entries(object(manifest.control_totals))) {
    const d=datasets.find(d=>d.filename===filename);
    if(!d)throw new DataError("INVALID_CONTROLS","Unknown control dataset.");
    const totals:Record<string,string>={};
    for(const [field,value]of Object.entries(object(input))) {
      if(!d.monetaryFields.includes(field) || typeof value!=="string" || !/^-?\d+\.\d{2}$/.test(value))throw new DataError("INVALID_CONTROLS","Invalid financial control.");
      totals[field]=value;
    }
    controls.control_totals[filename]=totals;
  }
  for(const [at,input]of Object.entries(object(manifest.inventory_controls))) {
    instant(at); const m=object(input),total=Number(m.total_inventory),backlog=Number(m.unlisted_backlog);
    if(typeof m.total_inventory!=="number" || typeof m.unlisted_backlog!=="number" || !Number.isSafeInteger(total) || total<1 || total>20000 ||
      !Number.isSafeInteger(backlog) || backlog<0 || backlog>total)throw new DataError("INVALID_CONTROLS","Invalid snapshot control.");
    controls.inventory_controls[at]={total_inventory:total,unlisted_backlog:backlog};
  }
  return controls;
}
export interface SeedOptions {
  confirmSyntheticOnly:true; includeIncremental?:boolean; includeTestFixtures?:boolean; owner:string;
}
/** Explicit supervised seed; no startup seed, background worker or silent fixture fallback. */
export async function seedFixturePack(intake:IntakeService, root:string, options:SeedOptions,
  transfer:(url:string,bytes:Uint8Array)=>Promise<void> = async(url,bytes)=>{
    const response=await fetch(url,{method:"PUT",headers:{"Content-Type":"application/octet-stream"},body:Buffer.from(bytes),signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new DataError("SEED_UPLOAD_FAILED","Private fixture upload failed.",503);
  }) {
  if(options.confirmSyntheticOnly!==true || !options.owner) throw new DataError("EXPLICIT_SEED_REQUIRED","Synthetic seed confirmation and authorized operator identity are required.");
  const controls=await loadApprovedControls(root), inputs=datasets.map(d=>({d,filename:d.filename,period:{startDate:"2026-08-01",endDate:"2026-08-31"},base:true}));
  if(options.includeIncremental) for(const source of ["ebay","shopgoodwill"]) {
    const filename=`incremental/${source}_sep01_2026.csv`, d=datasets.find(d=>d.id===source)!;
    inputs.push({d,filename,period:{startDate:"2026-09-01",endDate:"2026-09-01"},base:false});
  }
  if(options.includeTestFixtures) for(const name of ["ebay_duplicate_replay.csv","ebay_invalid_rows.csv"])
    inputs.push({d:datasets.find(d=>d.id==="ebay")!,filename:`test-fixtures/${name}`,period:{startDate:"2026-08-01",endDate:"2026-08-31"},base:false});
  const results=[];
  for(const {d,filename,period,base} of inputs) {
    const bytes=await readFile(path.join(root,filename)), checksum=hash(bytes);
    if(base && controls.files[filename]?.sha256!==checksum) throw new DataError("FIXTURE_HASH_MISMATCH","Supplied fixture differs from its independent manifest.");
    const ticket=await intake.requestUpload({sourceId:d.sourceId,reportType:d.reportType,filename:path.basename(filename),byteSize:bytes.length,checksum},options.owner);
    await transfer(ticket.uploadUrl,bytes);
    results.push(await intake.createBatch({sourceId:d.sourceId,reportType:d.reportType,period,inputKind:"upload",inputId:ticket.uploadId},options.owner));
  }
  return results;
}