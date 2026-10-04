import {readFile} from "node:fs/promises";
import path from "node:path";
import {IntakeService,ReportingService,DataError,loadApprovedControls,type Archive,type Artifact,type Repository,type Table,type Tx} from "../../src/goodwill/data";
import {hash} from "../../src/goodwill/data/normalize";
export const root=path.resolve("docs/goodwill/evidence/github/goodwill/synthetic-data");
export const august={startDate:"2026-08-01",endDate:"2026-08-31"};
/** TEST ONLY; these doubles are never imported by the runtime. */
export class MemoryRepository implements Repository {
  data=new Map<Table,Map<string,unknown>>(); private serial:Promise<unknown>=Promise.resolve();
  transaction<T>(work:(tx:Tx)=>Promise<T>):Promise<T> {
    const run=async()=>{
      const pending=new Map<Table,Map<string,unknown>>();
      const entries=(t:Table)=>new Map([...(this.data.get(t)??[]),...(pending.get(t)??[])]);
      const tx:Tx={
        async get<T>(t:Table,id:string) {return structuredClone((entries(t).get(id) as T)??null);},
        async list<T>(t:Table) {const values=[...entries(t).values()];return (t==="records" ? values : structuredClone(values)) as T[];},
        async put(t,id,document) {let collection=pending.get(t);if(!collection){collection=new Map();pending.set(t,collection);}collection.set(id,structuredClone(document));},
      };
      const result=await work(tx);
      for(const [t,docs] of pending){let collection=this.data.get(t);if(!collection){collection=new Map();this.data.set(t,collection);}for(const [id,doc]of docs)collection.set(id,doc);}
      return result;
    };
    const result=this.serial.then(run,run);this.serial=result.then(()=>undefined,()=>undefined);return result;
  }
}
export class MemoryArchive implements Archive {
  objects=new Map<string,Uint8Array>(); inbox=new Map<string,Uint8Array>(); fail=false;
  async put(id:string,bytes:Uint8Array,m:{filename:string;checksum:string}):Promise<Artifact>{
    if(this.fail)throw new DataError("STORAGE_UNAVAILABLE","Test archive unavailable.",503);
    const old=this.objects.get(id);if(old&&hash(old)!==hash(bytes))throw new DataError("IMMUTABLE_CONFLICT","Test immutable conflict.",409);
    this.objects.set(id,Uint8Array.from(bytes));
    return {artifactId:id,filename:m.filename,checksum:m.checksum,byteSize:bytes.length,archivedAt:new Date().toISOString(),synthetic:true};
  }
  async read(id:string){if(this.fail||!this.objects.has(id))throw new DataError("STORAGE_UNAVAILABLE","Test evidence unavailable.",503);return Uint8Array.from(this.objects.get(id)!);}
  async signUpload(id:string){return `https://test.invalid/${id}`;}
  async readUpload(id:string){if(!this.inbox.has(id))throw new DataError("STORAGE_UNAVAILABLE","Missing test upload.",503);return Uint8Array.from(this.inbox.get(id)!);}
}
export async function setup(){
  const repository=new MemoryRepository(),archive=new MemoryArchive(),controls=await loadApprovedControls(root);
  const intake=new IntakeService({repository,archive,controls,resolveVerifiedRun:async()=>{throw new DataError("RUN_NOT_VERIFIED","No verified test run.",409);}});
  const reporting=new ReportingService(repository,controls);
  return {repository,archive,controls,intake,reporting};
}
export async function upload(env:Awaited<ReturnType<typeof setup>>,sourceId:string,reportType:string,bytes:Uint8Array,p=august,filename="report.csv"){
  const ticket=await env.intake.requestUpload({sourceId,reportType,filename,byteSize:bytes.length,checksum:hash(bytes)},"operator");
  env.archive.inbox.set(ticket.uploadId,bytes);
  return env.intake.createBatch({sourceId,reportType,period:p,inputKind:"upload",inputId:ticket.uploadId},"operator");
}
export const file=(name:string)=>readFile(path.join(root,name));