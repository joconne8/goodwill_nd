import test from "node:test";
import assert from "node:assert/strict";
import {datasets,csvCell,exportCsv,IntakeService,type Batch,type LedgerRecord,type Publication,type StagedRow} from "../../src/goodwill/data";
import {hash} from "../../src/goodwill/data/normalize";
import {setup,upload,august} from "./helpers";

type Environment=Awaited<ReturnType<typeof setup>>;
function csv(datasetId:string,rows:Record<string,string>[]) {
  const dataset=datasets.find(d=>d.id===datasetId)!;
  return Buffer.from([dataset.header.map(csvCell).join(","),...rows.map(row=>dataset.header.map(f=>csvCell(row[f]??"")).join(","))].join("\n")+"\n");
}
function shipping(id:string,postage="1.00",adjustment="0.00",date="2026-08-01") {
  return {provider:"OSM",account:"synthetic",transaction_id:id,ship_date:date,
    service:"synthetic",postage_amount:postage,adjustment_amount:adjustment,gl_account:"synthetic",department:"synthetic"};
}
function upright(id:string,date="2026-08-01",gross="1.00") {
  return {paid_order_id:id,paid_at:`${date}T12:00:00-04:00`,item_id:`ITEM-${id}`,channel:"Upright",
    buyer_id:"synthetic-buyer",item_title:"Synthetic test",category:"Media",gross_sales:gross,shipping_collected:"0.00",
    sales_tax:"0.00",marketplace_fee:"0.00",refund_amount:"0.00",net_sales:"1.00"};
}
const query=(sourceId:string,metricId="shipping_expense",extra:object={})=>({sourceId,metricId,period:august,groupBy:"none",...extra});
async function verified(env:Environment,id:string,bytes:Buffer,period=august) {
  const artifact=await env.archive.put(id,bytes,{filename:"synthetic-upright.csv",checksum:hash(bytes)});
  const intake=new IntakeService({...env.intake.deps,resolveVerifiedRun:async()=>({bytes,artifact,
    manifest:{runId:id,sourceId:"upright",reportType:"paid_order_items",...period,checksum:hash(bytes),byteSize:bytes.length}})});
  return intake.createBatch({sourceId:"upright",reportType:"paid_order_items",period,inputKind:"run",inputId:id},"operator");
}
async function assertRetainedShipping(env:Environment,original:Batch) {
  const {result}=await env.reporting.query(query("shipping"));
  assert.equal(result.publicationId,original.publicationId);
  assert.equal(result.value,200);
  for(const kind of ["summary","evidence"]) {
    const exported=await exportCsv(env.reporting,{kind,query:query("shipping"),publicationId:original.publicationId});
    assert.equal(exported.checksum,hash(exported.csv));
  }
  await env.repository.transaction(async tx=>{
    assert.equal((await tx.get<{id:string}>("heads","current"))!.id,original.publicationId);
    assert.equal((await tx.list<Publication>("publications")).length,1);
    assert.equal((await tx.list<LedgerRecord>("records")).length,2);
  });
}

test("derived shipping overflow and signed cancellation cannot replace a reportable last-good publication",async()=>{
  const env=await setup();
  const original=await upload(env,"shipping","shipping_transactions",csv("shipping",[shipping("ORIGINAL-1"),shipping("ORIGINAL-2")]));
  assert.equal(original.state,"published");
  // Postage totals 6e15 and adjustments total 4e15 are individually safe; expenses total 1e16.
  const excessive=[shipping("LARGE-1","30000000000000.00","20000000000000.00"),
    shipping("LARGE-2","30000000000000.00","20000000000000.00")];
  const rejected=await upload(env,"shipping","shipping_transactions",csv("shipping",excessive));
  assert.equal(rejected.state,"quarantined");
  assert.equal(rejected.failure?.code,"UNSAFE_TOTAL");
  await assertRetainedShipping(env,original);
  // Cancellation makes the overall expense safe (7e15), but August 1 still overflows (1e16).
  const cancellation=await upload(env,"shipping","shipping_transactions",csv("shipping",[
    ...excessive.map((row,i)=>({...row,transaction_id:`CANCEL-POS-${i}`})),
    shipping("CANCEL-NEG","0.00","-30000000000000.00","2026-08-02"),
  ]));
  assert.equal(cancellation.state,"quarantined");
  assert.equal(cancellation.failure?.code,"UNSAFE_TOTAL");
  await assertRetainedShipping(env,original);
});

test("reviewed supersession rolls back all staging, audit and head changes when derived expense would overflow",async()=>{
  const env=await setup();
  const original=await upload(env,"shipping","shipping_transactions",csv("shipping",[shipping("ORIGINAL-1"),shipping("ORIGINAL-2")]));
  const correction=await upload(env,"shipping","shipping_transactions",csv("shipping",[
    shipping("ORIGINAL-1","30000000000000.00","20000000000000.00"),
    shipping("ORIGINAL-2","30000000000000.00","20000000000000.00"),
  ]));
  assert.equal(correction.failure?.code,"CONFLICTING_IDENTITY");
  await assert.rejects(env.intake.review(correction.id,{action:"approve_supersession",reason:"Explicit synthetic overflow regression",
    confirmSyntheticOnly:true,expectedPublicationId:original.publicationId},"reviewer"),{code:"UNSAFE_TOTAL"});
  await assertRetainedShipping(env,original);
  await env.repository.transaction(async tx=>{
    assert.equal((await tx.get<Batch>("batches",original.id))!.state,"published");
    assert.equal((await tx.get<Batch>("batches",correction.id))!.failure?.code,"CONFLICTING_IDENTITY");
    assert.equal((await tx.list("audit")).length,0);
    assert.equal((await tx.list<StagedRow>("rows")).filter(r=>r.batchId===correction.id).every(r=>r.disposition==="rejected"),true);
  });
});

test("verified acquisition with a malformed money row has partial coverage and cannot infer missing-day zeros",async()=>{
  const env=await setup();
  const bytes=csv("upright",[upright("VALID"),upright("MALFORMED","2026-08-02","not-money")]);
  const partial=await verified(env,"verified-partial",bytes);
  assert.equal(partial.state,"partial");
  assert.equal(partial.acceptedRows,1);
  assert.equal(partial.rejectedRows,1);
  assert.equal(partial.coverageComplete,false);
  const daily=query("upright","net_item_sales",{groupBy:"day"});
  const {result}=await env.reporting.query(daily);
  assert.equal(result.value,100);
  assert.equal(result.coverage[0].status,"partial");
  assert.deepEqual(result.points.map(p=>[p.key,p.value]),[["2026-08-01",100]]);
  const missing=await env.reporting.query({...daily,period:{startDate:"2026-08-02",endDate:"2026-08-03"}});
  assert.equal(missing.result.value,null);
  assert.deepEqual(missing.result.points,[]);
  const evidence=await env.reporting.evidence({query:daily,publicationId:partial.publicationId!,offset:0,limit:100});
  assert.equal(evidence.total,1);
  assert.equal(evidence.items[0].values.metricValue,"100");
  const exported=await exportCsv(env.reporting,{kind:"summary",query:daily,publicationId:partial.publicationId});
  assert.match(exported.csv,/upright:partial/);
  assert.doesNotMatch(exported.csv,/2026-08-02/);
});

test("complete accepted acquisition still proves zeros; later partial input cannot certify its interval but retains independent coverage",async()=>{
  const env=await setup(),period={startDate:"2026-08-01",endDate:"2026-08-03"};
  const good=await verified(env,"verified-complete",csv("upright",[upright("COMPLETE")]),period);
  assert.equal(good.coverageComplete,true);
  const daily=query("upright","net_item_sales",{period,groupBy:"day"});
  assert.deepEqual((await env.reporting.query(daily)).result.points.map(p=>[p.key,p.value]),
    [["2026-08-01",100],["2026-08-02",0],["2026-08-03",0]]);
  const partial=await verified(env,"later-partial",csv("upright",[upright("NEW-VALID"),upright("BAD","2026-08-02","bad")]),period);
  assert.equal(partial.state,"partial");
  assert.equal(partial.coverageComplete,false);
  const {result}=await env.reporting.query(daily);
  assert.equal(result.coverage[0].status,"complete");
  assert.deepEqual(result.points.map(p=>[p.key,p.value]),[["2026-08-01",200],["2026-08-02",0],["2026-08-03",0]]);
  assert.equal(result.batchIds.includes(good.id),true);
});