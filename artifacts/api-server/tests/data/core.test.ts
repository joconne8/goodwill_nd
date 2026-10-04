import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import express from "express";
import {CreateGoodwillBatchResponse,QueryGoodwillMetricsResponse,GetGoodwillCatalogResponse,QueryGoodwillEvidenceResponse} from "@workspace/api-zod";
import {createDataRouter,datasets,seedFixturePack,exportCsv,csvCell,IntakeService,DataError,PrivateArchive} from "../../src/goodwill/data";
import {hash,money,normalize,parseCsv} from "../../src/goodwill/data/normalize";
import {setup,upload,file,root,august} from "./helpers";
const query=(sourceId:string,metricId="net_item_sales",extra:object={})=>({sourceId,metricId,period:august,groupBy:"none",...extra});
const oracle=JSON.parse(execFileSync("python",["docs/goodwill/data/independent-controls.py"],{encoding:"utf8"}));

test("all 15 unchanged inputs reconcile independently; source metrics, daily customers, listing and selected snapshot controls",async()=>{
  const env=await setup(),started=Date.now();
  const batches=await seedFixturePack(env.intake,root,{confirmSyntheticOnly:true,owner:"operator"},async(url,bytes)=>{env.archive.inbox.set(url.split("/").at(-1)!,bytes);});
  assert.equal(batches.length,15);
  for(const [i,b]of batches.entries()){
    assert.equal(b.state,"published",`${b.datasetId}: ${JSON.stringify(b.failure)}`);
    assert.equal(b.inputRows,oracle.files[datasets[i].filename].rows);
    assert.equal(b.inputRows,b.acceptedRows+b.rejectedRows+b.duplicateRows);
    assert.equal(b.reconciliation.every(c=>c.status!=="mismatch"),true);
    assert.equal(b.artifact!.checksum,oracle.files[datasets[i].filename].sha256);
    assert.equal(CreateGoodwillBatchResponse.safeParse(b).success,true);
    assert.deepEqual(Buffer.from(await env.archive.read(b.artifact!.artifactId)),await file(datasets[i].filename));
  }
  const controls:Record<string,unknown>={};
  for(const [metricId,expected]of [["net_item_sales",oracle.net_items],["source_net",oracle.source_net],["shipping_expense",oracle.expenses]] as const)
    for(const [source,total]of Object.entries(expected)){
      const {result,evidence}=await env.reporting.query(query(source,metricId,{groupBy:"store"}));
      assert.equal(QueryGoodwillMetricsResponse.safeParse(result).success,true);
      assert.equal(result.value,total,`${source}/${metricId}`);
      assert.equal(result.points.reduce((sum,p)=>sum+p.value,0),total);
      assert.equal(evidence.reduce((sum,r)=>sum+Number(r.values.metricValue),0),total);
      controls[`${source}/${metricId}`]={expected:total,actual:result.value,rows:evidence.length};
    }
  for(const [source,expected]of Object.entries(oracle.customers)){
    const {result}=await env.reporting.query(query(source,"daily_customers",{groupBy:"day"}));
    assert.equal(result.value,null);
    assert.deepEqual(Object.fromEntries(result.points.map(p=>[p.key,p.value])),expected);
    const one=await env.reporting.query(query(source,"daily_customers",{period:{startDate:"2026-08-01",endDate:"2026-08-01"},groupBy:"store"}));
    assert.equal(one.result.value,(expected as Record<string,number>)["2026-08-01"]);
  }
  assert.equal((await env.reporting.query(query("upright","daily_customers",{groupBy:"day"}))).result.coverage[0].missingRows,8);
  for(const [source,total]of Object.entries(oracle.listings))assert.equal((await env.reporting.query(query(source,"listings"))).result.value,total);
  for(const [at,counts]of Object.entries(oracle.snapshots))
    for(const [source,total]of Object.entries(counts as object)){
      const {result,evidence}=await env.reporting.query(query(source,"backlog",{snapshotAt:at,groupBy:"category"}));
      assert.equal(result.value,total,`${source}/${at}`);assert.equal(evidence.length,total);
    }
  const catalog=await env.reporting.catalog();assert.equal(GetGoodwillCatalogResponse.safeParse(catalog).success,true);
  assert.equal(catalog.datasets.length,15);assert.equal(catalog.stores.length,24);
  await assert.rejects(env.reporting.query(query("shopgoodwill","unsupported")),{code:"INVALID_QUERY"});
  await mkdir("docs/goodwill/data/evidence",{recursive:true});
  await writeFile("docs/goodwill/data/evidence/controls.json",JSON.stringify({synthetic:true,verification:"test-only archive/repository; independently computed original-byte controls",elapsedMs:Date.now()-started,controls},null,2)+"\n");
});

test("common intake deduplicates exact files, overlapping source keys, opt-in fixtures and September increments",async()=>{
  const env=await setup(),base=await file("08_ebay_listing_sales_aug2026.csv");
  const first=await upload(env,"ebay","listing_sales",base);
  assert.equal(first.state,"published");
  const replay=await upload(env,"ebay","listing_sales",base);
  assert.equal(replay.state,"duplicate");assert.equal(replay.duplicateOf,first.id);
  const overlap=await upload(env,"ebay","listing_sales",await file("test-fixtures/ebay_duplicate_replay.csv"));
  assert.equal(overlap.state,"duplicate");assert.equal(overlap.duplicateRows,25);
  const invalid=await upload(env,"ebay","listing_sales",await file("test-fixtures/ebay_invalid_rows.csv"));
  assert.equal(invalid.state,"quarantined");assert.equal(invalid.rejectedRows,5);
  const rows=await env.reporting.batchRows(invalid.id);
  assert.deepEqual(rows.items.map(r=>r.reasons[0].code),["INVALID_DATE","INVALID_MONEY","MISSING_KEY","INVALID_MONEY","INVALID_REFUND"]);
  assert.equal((await env.reporting.query(query("ebay"))).result.value,5551526);
  await assert.rejects(env.reporting.query(query("ebay","unsupported")),{code:"INVALID_QUERY"});
  const increment=await upload(env,"ebay","listing_sales",await file("incremental/ebay_sep01_2026.csv"),{startDate:"2026-09-01",endDate:"2026-09-01"});
  assert.equal(increment.state,"published");assert.equal(increment.acceptedRows,30);
  assert.equal((await env.reporting.query(query("ebay"))).result.value,5551526);
  assert.ok((await env.reporting.query(query("ebay","net_item_sales",{period:{startDate:"2026-09-01",endDate:"2026-09-01"}}))).result.value!>0);
  const shop=await upload(env,"shopgoodwill","periodic_sales",await file("incremental/shopgoodwill_sep01_2026.csv"),{startDate:"2026-09-01",endDate:"2026-09-01"});
  assert.equal(shop.acceptedRows,60);
});

test("conflicting correction is reviewed against the current revision; pinned evidence/export and old raw bytes never change",async()=>{
  const env=await setup(),base=await file("08_ebay_listing_sales_aug2026.csv"),old=await upload(env,"ebay","listing_sales",base);
  const original=(await env.reporting.query(query("ebay"))).result;
  const lines=base.toString().trimEnd().split("\n"),fields=lines[1].split(",");
  fields[8]=(Number(fields[8])+1).toFixed(2);fields[13]=(Number(fields[13])+1).toFixed(2);lines[1]=fields.join(",");
  const changed=Buffer.from(lines.join("\n")+"\n"),conflict=await upload(env,"ebay","listing_sales",changed);
  assert.equal(conflict.state,"quarantined");assert.equal(conflict.failure?.code,"CONFLICTING_IDENTITY");
  assert.equal((await env.reporting.query(query("ebay"))).result.value,5551526);
  await assert.rejects(env.intake.review(conflict.id,{action:"approve_supersession",expectedPublicationId:"wrong",reason:"Synthetic correction reviewed",confirmSyntheticOnly:true},"reviewer"),{code:"PUBLICATION_CHANGED"});
  const approved=await env.intake.review(conflict.id,{action:"approve_supersession",expectedPublicationId:original.publicationId,reason:"Synthetic one-dollar line correction reviewed",confirmSyntheticOnly:true},"reviewer");
  assert.equal(approved.supersedesBatchId,old.id);assert.equal((await env.reporting.query(query("ebay"))).result.value,5551626);
  const audits=await env.repository.transaction(tx=>tx.list<{before:{state:string};originalStaging:{reasons:string[]}[]}>("audit"));
  assert.equal(audits[0].before.state,"quarantined");assert.equal(audits[0].originalStaging.some(r=>r.reasons.includes("CONFLICTING_IDENTITY")),true);
  assert.equal((await env.reporting.query(query("ebay"),original.publicationId!)).result.value,5551526);
  const evidence=await env.reporting.evidence({query:query("ebay"),publicationId:original.publicationId!,offset:0,limit:1});
  assert.equal(QueryGoodwillEvidenceResponse.safeParse(evidence).success,true);assert.equal(evidence.total,900);assert.equal(evidence.items.length,1);
  const exported=await exportCsv(env.reporting,{kind:"evidence",query:query("ebay"),publicationId:original.publicationId});
  assert.equal(exported.checksum,hash(exported.csv));assert.equal(exported.csv.split("\r\n").length,902);
  assert.deepEqual(Buffer.from(await env.archive.read(old.artifact!.artifactId)),base);
  const again=await upload(env,"ebay","listing_sales",base);assert.equal(again.state,"duplicate");
  assert.equal((await env.reporting.query(query("ebay"))).result.value,5551626);
});

test("partial rows, formula failures, unavailable grains, atomic upload consumption and explicit review rejection preserve last-good",async()=>{
  const env=await setup(),base=await file("08_ebay_listing_sales_aug2026.csv");
  const lines=base.toString().trimEnd().split("\n");
  const invalid=lines[2].split(",");invalid[8]="bad";
  const partial=await upload(env,"ebay","listing_sales",Buffer.from([lines[0],lines[1],invalid.join(",")].join("\n")+"\n"));
  assert.equal(partial.state,"partial");assert.equal(partial.acceptedRows,1);assert.equal(partial.rejectedRows,1);
  const last=(await env.reporting.query(query("ebay"))).result;
  const formula=lines[3].split(",");formula[13]="0.00";
  const held=await upload(env,"ebay","listing_sales",Buffer.from([lines[0],lines[4],formula.join(",")].join("\n")+"\n"));
  assert.equal(held.state,"quarantined");assert.equal(held.failure?.code,"RECONCILIATION_MISMATCH");
  assert.equal((await env.reporting.query(query("ebay"))).result.value,last.value);
  assert.equal((await env.reporting.query(query("ebay","net_item_sales",{period:{startDate:"2026-09-01",endDate:"2026-09-01"}}))).result.value,null);
  for(const source of ["amazon","jewelry","goodwill_books"])assert.equal((await env.reporting.query(query(source,"daily_customers",{groupBy:"day"}))).result.value,null);
  assert.equal((await env.reporting.query(query("ebay","backlog",{snapshotAt:"2026-08-31T23:59:59-04:00"}))).result.value,null);
  const ticket=await env.intake.requestUpload({sourceId:"ebay",reportType:"listing_sales",filename:"race.csv",byteSize:base.length,checksum:hash(base)},"operator");
  env.archive.inbox.set(ticket.uploadId,base);
  const request={sourceId:"ebay",reportType:"listing_sales",period:august,inputKind:"upload",inputId:ticket.uploadId};
  const racing=await Promise.all([env.intake.createBatch(request,"operator"),env.intake.createBatch(request,"operator")]);
  assert.equal(racing.filter(b=>b.failure?.code==="UPLOAD_CONSUMED").length,1);
  const conflict=racing.find(b=>b.failure?.code==="CONFLICTING_IDENTITY");
  if(conflict) {
    const current=(await env.reporting.query(query("ebay"))).result;
    await env.intake.review(conflict.id,{action:"reject",expectedPublicationId:current.publicationId,reason:"Reject synthetic competing replacement",confirmSyntheticOnly:true},"reviewer");
    assert.equal((await env.reporting.query(query("ebay"))).result.value,current.value);
  }
  const correction=lines[1].split(",");correction[8]=(Number(correction[8])+1).toFixed(2);correction[13]=(Number(correction[13])+1).toFixed(2);
  const rejected=await upload(env,"ebay","listing_sales",Buffer.from([lines[0],correction.join(",")].join("\n")+"\n"));
  assert.equal(rejected.failure?.code,"CONFLICTING_IDENTITY");
  const before=(await env.reporting.query(query("ebay"))).result;
  await env.intake.review(rejected.id,{action:"reject",expectedPublicationId:before.publicationId,reason:"Reject explicit synthetic line correction",confirmSyntheticOnly:true},"reviewer");
  assert.equal((await env.reporting.query(query("ebay"))).result.value,before.value);
});

test("exact bytes, UTF-8/CSV ordinal, money, period, schema and upload identity negative boundaries",async()=>{
  for(const amount of ["NaN","1.999","1e2","-1.00","90071992547409.92"])assert.throws(()=>money(amount),DataError);
  assert.equal(money("0.01"),1);
  const d=datasets.find(d=>d.id==="ebay")!,base=await file(d.filename),fields=parseCsv(base,d.header)[0];
  fields[6]='=HYPERLINK("evil")\nquoted';fields[7]="2";
  const csv=Buffer.from([d.header.map(csvCell).join(","),fields.map(csvCell).join(",")].join("\r\n")+"\r\n");
  const parsed=parseCsv(csv,d.header);assert.equal(parsed.length,1);assert.equal(normalize(d,parsed[0],august).netItemMinor,money(fields[8])-money(fields[12]));
  assert.equal(csvCell("=2+3"),'"\'=2+3"');assert.equal(csvCell("-10"),'"\'-10"');assert.equal(csvCell(-10),'"-10"');
  const env=await setup();
  await assert.rejects(env.intake.requestUpload({sourceId:"ebay",reportType:"listing_sales",filename:"../secret.csv",byteSize:1,checksum:"a".repeat(64)},"operator"),{code:"INVALID_FILENAME"});
  await assert.rejects(env.reporting.query(query("all")),{code:"INVALID_SOURCE"});
  await assert.rejects(env.reporting.query(query("ebay","net_item_sales",{period:{startDate:"2026-08-32",endDate:"2026-08-31"}})),{code:"INVALID_DATE"});
  await assert.rejects(env.reporting.query(query("ebay","backlog",{snapshotAt:1780000000000})),{code:"INVALID_QUERY"});
  await assert.rejects(exportCsv(env.reporting,{kind:"summary",batchId:"wrong"}),{code:"INVALID_EXPORT_COMBINATION"});
  const ticket=await env.intake.requestUpload({sourceId:"ebay",reportType:"listing_sales",filename:"bytes.csv",byteSize:base.length,checksum:hash(base)},"operator");
  env.archive.inbox.set(ticket.uploadId,Uint8Array.from([...base,0]));
  assert.equal((await env.intake.createBatch({sourceId:"ebay",reportType:"listing_sales",period:august,inputKind:"upload",inputId:ticket.uploadId},"operator")).failure?.code,"ARTIFACT_IDENTITY_MISMATCH");
  const bad=await upload(env,"ebay","listing_sales",Buffer.from("other,header\n1,2\n"));assert.equal(bad.inputRows,0);assert.equal(bad.state,"quarantined");
  assert.throws(()=>parseCsv(Uint8Array.from([255]),d.header),{code:"INVALID_ENCODING"});
});

test("verified acquisition and upload use the same archive, parser and publication path; infrastructure failure is visible",async()=>{
  const env=await setup(),bytes=await file("02_upright_paid_order_items_aug2026.csv"),artifact=await env.archive.put("verified-run",bytes,{filename:"upright.csv",checksum:hash(bytes)});
  const acquired=new IntakeService({...env.intake.deps,resolveVerifiedRun:async()=>({bytes,artifact,manifest:{runId:"verified-run",sourceId:"upright",reportType:"paid_order_items",...august,checksum:hash(bytes),byteSize:bytes.length}})});
  const batch=await acquired.createBatch({sourceId:"upright",reportType:"paid_order_items",period:august,inputKind:"run",inputId:"verified-run"},"operator");
  assert.equal(batch.state,"published");assert.equal(batch.runId,"verified-run");assert.equal((await env.reporting.query(query("upright"))).result.value,3615710);
  const manual=await upload(env,"upright","paid_order_items",bytes);assert.equal(manual.state,"duplicate");
  env.archive.fail=true;
  const failed=await upload(env,"ebay","listing_sales",await file("08_ebay_listing_sales_aug2026.csv"));
  assert.equal(failed.state,"failed");assert.equal(failed.failure?.code,"STORAGE_UNAVAILABLE");
  assert.equal((await env.reporting.query(query("upright"))).result.value,3615710);
});

test("private GCS adapter seals original bytes once, pins object generations and rejects arbitrary paths",async()=>{
  const data=new Map<string,Buffer>(),metadata=new Map<string,{checksum:string}>(),options:object[]=[];
  const storage={bucket:(_name:string)=>({file:(name:string,_opts?:object)=>({
    async save(bytes:Buffer,opts:object){options.push(opts);if(data.has(name))throw Object.assign(new Error("exists"),{code:412});data.set(name,Buffer.from(bytes));metadata.set(name,(opts as {metadata:{metadata:{checksum:string}}}).metadata.metadata);},
    async getMetadata(){return [{size:String(data.get(name)!.length),generation:"123",metadata:metadata.get(name)}] as [{size:string;generation:string;metadata?:{checksum:string}}];},
    async download(){return [Buffer.from(data.get(name)!)] as [Buffer];},
  })})};
  const archive=new PrivateArchive(storage,"/private-bucket/.private",async()=>"https://storage.test.invalid/signed");
  const bytes=Buffer.from("exact\r\nbytes"),meta={filename:"safe.csv",checksum:hash(bytes)};
  const first=await archive.put("opaque-id",bytes,meta),second=await archive.put("opaque-id",bytes,meta);
  assert.equal(first.checksum,second.checksum);assert.deepEqual(Buffer.from(await archive.read(first.artifactId)),bytes);
  assert.deepEqual((options[0] as {preconditionOpts:unknown}).preconditionOpts,{ifGenerationMatch:0});
  await assert.rejects(archive.put("opaque-id",Buffer.from("changed"),{filename:"safe.csv",checksum:hash("changed")}),{code:"IMMUTABLE_ARTIFACT_CONFLICT"});
  await assert.rejects(archive.read("../secret"),{code:"INVALID_ARTIFACT_ID"});
});

test("HTTP router enforces operator authorization, frozen request/response shapes and real evidence/export behavior",async()=>{
  const env=await setup(),app=express();app.use(express.json());
  app.use("/api/goodwill/v2",createDataRouter(env.intake,env.reporting,async req=>req.header("x-test-operator")==="yes" ? "operator" : null));
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  const address=server.address() as {port:number},url=`http://127.0.0.1:${address.port}/api/goodwill/v2`;
  const headers={"Content-Type":"application/json","x-test-operator":"yes"};
  try{
    assert.equal((await fetch(url+"/catalog")).status,401);
    const catalog=await(await fetch(url+"/catalog",{headers})).json();assert.equal(GetGoodwillCatalogResponse.safeParse(catalog).success,true);
    await upload(env,"ebay","listing_sales",await file("08_ebay_listing_sales_aug2026.csv"));
    const result=await(await fetch(url+"/metrics/query",{method:"POST",headers,body:JSON.stringify(query("ebay"))})).json();
    assert.equal(result.value,5551526);assert.equal(QueryGoodwillMetricsResponse.safeParse(result).success,true);
    const evidence=await(await fetch(url+"/evidence/query",{method:"POST",headers,body:JSON.stringify({query:query("ebay"),publicationId:result.publicationId,offset:100,limit:7})})).json();
    assert.equal(evidence.total,900);assert.equal(evidence.items.length,7);
    assert.equal(QueryGoodwillEvidenceResponse.safeParse(evidence).success,true);
    const exported=await(await fetch(url+"/exports",{method:"POST",headers,body:JSON.stringify({kind:"summary",query:query("ebay"),publicationId:result.publicationId})})).json();
    assert.equal(exported.checksum,hash(exported.csv));
    assert.equal((await fetch(url+"/batches?limit=1.5",{headers})).status,400);
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

test("expired, foreign-owner and wrong-scope tickets are held; raw encoding and blocking independent controls never replace last-good",async()=>{
  const env=await setup(),bytes=await file("08_ebay_listing_sales_aug2026.csv");
  const make=()=>env.intake.requestUpload({sourceId:"ebay",reportType:"listing_sales",filename:"safe.csv",byteSize:bytes.length,checksum:hash(bytes)},"operator");
  const ticket=await make();env.archive.inbox.set(ticket.uploadId,bytes);
  const body={sourceId:"ebay",reportType:"listing_sales",period:august,inputKind:"upload",inputId:ticket.uploadId};
  assert.equal((await env.intake.createBatch(body,"other-operator")).failure?.code,"UPLOAD_NOT_FOUND");
  await env.repository.transaction(async tx=>{
    const stored=await tx.get<import("../../src/goodwill/data").Upload>("uploads",ticket.uploadId);
    await tx.put("uploads",ticket.uploadId,{...stored,expiresAt:"2000-01-01T00:00:00.000Z"});
  });
  assert.equal((await env.intake.createBatch(body,"operator")).failure?.code,"UPLOAD_EXPIRED");
  const wrong=await make();env.archive.inbox.set(wrong.uploadId,bytes);
  assert.equal((await env.intake.createBatch({...body,inputId:wrong.uploadId,sourceId:"cash_monkey",reportType:"orders"},"operator")).failure?.code,"RECEIPT_SCOPE_MISMATCH");
  const good=await upload(env,"upright","paid_order_items",await file("02_upright_paid_order_items_aug2026.csv"));
  env.controls.control_totals["08_ebay_listing_sales_aug2026.csv"].sale_amount="0.01";
  const mismatch=await upload(env,"ebay","listing_sales",bytes);
  assert.equal(mismatch.failure?.code,"RECONCILIATION_MISMATCH");
  assert.equal(mismatch.reconciliation.some(c=>c.status==="mismatch"),true);
  assert.equal((await env.reporting.query(query("upright"))).result.publicationId,good.publicationId);
  const badHeader=await upload(env,"ebay","listing_sales",Buffer.from("x\n1\n"));
  assert.equal(badHeader.inputRows,0);
  const summary=await exportCsv(env.reporting,{kind:"rejections",batchId:mismatch.id});
  assert.equal(summary.checksum,hash(summary.csv));
});

test("unsafe aggregate cents are quarantined before publication and fixtures remain explicitly opt-in",async()=>{
  const env=await setup(),d=datasets.find(d=>d.id==="cash_monkey")!,base=await file(d.filename),rows=parseCsv(base,d.header);
  const large=rows.slice(0,2).map(r=>{const v=[...r];v[8]="60000000000000.00";v[9]="0.00";v[10]="0.00";v[11]="0.00";v[12]=v[8];return v;});
  const text=[d.header.join(","),...large.map(r=>r.map(csvCell).join(","))].join("\n")+"\n";
  const unsafe=await upload(env,d.sourceId,d.reportType,Buffer.from(text));
  assert.equal(unsafe.failure?.code,"UNSAFE_TOTAL");assert.equal((await env.reporting.query(query("cash_monkey"))).result.publicationId,null);
  const seeded=await seedFixturePack(env.intake,root,{confirmSyntheticOnly:true,owner:"operator",includeIncremental:true,includeTestFixtures:true},async(url,bytes)=>env.archive.inbox.set(url.split("/").at(-1)!,bytes));
  assert.equal(seeded.length,19);assert.equal(seeded.at(-1)!.rejectedRows,5);assert.equal(seeded.at(-2)!.duplicateRows,25);
});
