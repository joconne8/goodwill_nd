import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { ExportGoodwillSupersetSnapshotResponse } from "@workspace/api-zod";
import { AnalyticsService } from "../../src/goodwill/analytics/service";
import { createAnalyticsRouter } from "../../src/goodwill/analytics/router";
import { framework } from "../../src/goodwill/analytics/definitions";
import { seedFixturePack } from "../../src/goodwill/data";
import { hash } from "../../src/goodwill/data/normalize";
import { setup, root, august } from "../data/helpers";

const env=await setup();
await seedFixturePack(env.intake,root,{confirmSyntheticOnly:true,owner:"operator"},
  async(url,bytes)=>{env.archive.inbox.set(url.split("/").at(-1)!,bytes);});
const service=new AnalyticsService(env.repository,env.reporting);
const query=(sourceId="shopgoodwill",extra:object={})=>service.query({sourceId,period:august,...extra});
const k=(d:Awaited<ReturnType<typeof query>>,id:string)=>d.kpis.find(k=>k.id===id)!;

test("all sponsor measures, exact COO count, three priorities and no invented enterprise economics",async()=>{
  const d=await query();
  assert.equal(d.kpis.length,34);assert.equal(new Set(d.kpis.map(k=>k.id)).size,34);
  assert.equal(d.kpis.filter(k=>k.coo).length,15);assert.equal(d.kpis.filter(k=>k.plan2027).length,3);
  assert.equal(d.channels.length,9);assert.equal(d.synthetic,true);assert.ok(d.publicationId);
  for(const id of ["enterprise_revenue","yoy_growth","net_margin","gross_margin","revenue_labor","profit_labor","donation_listing","new_buyers","sell_through","conversion","nps","relisted","unsold"]){
    assert.equal(k(d,id).value,null);assert.equal(k(d,id).status,"unavailable");assert.ok(k(d,id).requiredInputs.length);
  }
  assert.equal(framework.every(k=>k.value===null && !k.points.length),true);
});
test("source-local sales reconcile to existing evidence; category and weighted quantity ASP are real",async()=>{
  for(const sourceId of ["shopgoodwill","upright","ebay","cash_monkey"]){
    const d=await query(sourceId);
    const {result}=await env.reporting.query({sourceId,metricId:"net_item_sales",period:august,groupBy:"category"},d.publicationId!);
    assert.equal(k(d,"category_sales").value,result.value);
    assert.deepEqual(k(d,"category_sales").points.map(p=>[p.label,p.value]).sort(),result.points.map(p=>[p.key,p.value]).sort());
    assert.equal(k(d,"asp").status,"available");assert.equal(k(d,"median_price").status,"available");
    assert.equal(k(d,"category_asp").value,null);assert.ok(k(d,"category_asp").points.length);
    assert.equal(k(d,"asp").value,k(d,"category_sales").value!/k(d,"category_units").value!);
    assert.ok(k(d,"asp").evidenceQuery);
  }
});
test("catalog operations and validated stock, not donation/lifetime inference",async()=>{
  const d=await query();
  assert.ok(k(d,"listings_created").value!>0);
  assert.ok(k(d,"listings_daily").points.length);assert.equal(k(d,"listings_daily").status,"available");
  assert.ok(k(d,"backlog").value!>0);assert.equal(k(d,"time_to_list").status,"partial");
  assert.equal(k(d,"days_sell").status,"partial");
  assert.ok(k(d,"buyers").value!>0);assert.equal(k(d,"repeat_buyers").status,"partial");
  assert.equal(k(d,"new_buyers").value,null);
});
test("nightly customer grain and month-only Books cannot be manufactured",async()=>{
  const monthly=await query();assert.equal(monthly.channels.every(c=>c.customers===null),true);
  const nightly=await query("shopgoodwill",{period:{startDate:"2026-08-31",endDate:"2026-08-31"}});
  const sg=nightly.channels.find(c=>c.sourceId==="shopgoodwill")!;
  const {result}=await env.reporting.query({sourceId:"shopgoodwill",metricId:"daily_customers",period:nightly.query.period,groupBy:"day"});
  assert.equal(sg.customers,result.value);
  assert.equal(nightly.channels.find(c=>c.sourceId==="goodwill_books")!.revenue,null);
  assert.equal(nightly.channels.find(c=>c.sourceId==="amazon")!.customers,null);
});
test("unsupported data, store-attribution and invalid temporal scopes fail explicitly",async()=>{
  const none=await query("amazon",{period:{startDate:"2025-08-01",endDate:"2025-08-31"}});
  assert.ok(none.channels.every(c=>c.revenue===null));assert.equal(k(none,"asp").value,null);
  const store=await query("shopgoodwill",{storeId:"GW-001"});
  assert.equal(store.channels.find(c=>c.sourceId==="fedex")!.revenue,null);
  assert.equal(store.channels.find(c=>c.sourceId==="goodwill_books")!.revenue,null);
  await assert.rejects(query("shopgoodwill",{period:{startDate:"2026-02-30",endDate:"2026-03-01"}}));
  await assert.rejects(query("shopgoodwill",{period:{startDate:"2020-01-01",endDate:"2026-08-31"}}));
  await assert.rejects(query("all_sources"));await assert.rejects(query("shopgoodwill",{storeId:"GW-999"}));
});

test("Superset snapshot is authenticated, publication-pinned, bounded and aggregate-only",async()=>{
  const app=express();app.use(express.json());
  app.use(createAnalyticsRouter(service,async req=>req.header("x-operator")==="approved"?"operator":null));
  const server=app.listen(0),address=server.address();
  assert.ok(address&&typeof address!=="string");
  const base=`http://127.0.0.1:${address.port}`;
  try {
    const request={sourceId:"shopgoodwill",period:august};
    assert.equal((await fetch(base+"/analytics/superset-snapshot",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(request)})).status,401);
    const response=await fetch(base+"/analytics/superset-snapshot",{method:"POST",headers:{"content-type":"application/json","x-operator":"approved"},body:JSON.stringify(request)});
    assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/no-store/);
    assert.match(response.headers.get("content-disposition")??"",/attachment/);
    const snapshot=await response.json();
    assert.equal(ExportGoodwillSupersetSnapshotResponse.safeParse(snapshot).success,true);
    assert.equal(snapshot.synthetic,true);assert.equal(snapshot.sourceId,request.sourceId);
    assert.equal(snapshot.period.startDate,august.startDate);assert.ok(snapshot.publicationId);
    assert.equal(snapshot.metrics.some((m:{metricId:string})=>m.metricId==="daily_customers"),true);
    const customers=snapshot.metrics.find((m:{metricId:string})=>m.metricId==="daily_customers")!;
    assert.equal(customers.value,null,"monthly daily-customer points are not period-unique customers");
    assert.equal(customers.points.length,31);
    const direct=await env.reporting.query({sourceId:"shopgoodwill",metricId:"net_item_sales",period:august,groupBy:"day"},snapshot.publicationId);
    assert.equal(snapshot.metrics.find((m:{metricId:string})=>m.metricId==="net_item_sales")!.points.reduce((n:number,p:{value:number})=>n+p.value,0),direct.result.value);
    const body={...snapshot};delete body.snapshotId;delete body.checksum;
    assert.equal(snapshot.checksum,hash(JSON.stringify(body)));
    const text=JSON.stringify(snapshot);
    for(const forbidden of ["buyer_id","buyerId","recordId","sourceRow","employeeId","rejectedRows","rawArtifact"])
      assert.equal(text.includes(forbidden),false,`snapshot must not include ${forbidden}`);
    assert.equal(snapshot.metrics.every((m:{coverage:unknown[]})=>m.coverage.length<=2),true);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

test("Superset snapshot keeps statement-month and missing-versus-zero semantics",async()=>{
  const full=await service.exportSupersetSnapshot({sourceId:"goodwill_books",period:august});
  const books=full.metrics.find(m=>m.metricId==="source_net")!;
  assert.equal(books.status,"partial","partial source coverage remains visible rather than being promoted to complete");
  const incomplete=await service.exportSupersetSnapshot({sourceId:"goodwill_books",period:{startDate:"2026-08-31",endDate:"2026-08-31"}});
  const unavailable=incomplete.metrics.find(m=>m.metricId==="source_net")!;
  assert.equal(unavailable.status,"unavailable");assert.equal(unavailable.value,null);
  assert.match(unavailable.availabilityReason??"",/statement-month/i);
  const absent=await service.exportSupersetSnapshot({sourceId:"shipping",period:{startDate:"2025-08-01",endDate:"2025-08-01"}});
  const missing=absent.metrics[0]!;
  assert.equal(missing.status,"unavailable");assert.equal(missing.value,null);assert.equal(missing.points.length,0);
  await assert.rejects(service.exportSupersetSnapshot({sourceId:"shopgoodwill",period:august,snapshotAt:"2026-08-31T23:59:59-04:00"}));
  await assert.rejects(service.exportSupersetSnapshot({sourceId:"shopgoodwill",period:august,storeId:"GW-999"}));
  await assert.rejects(service.exportSupersetSnapshot({sourceId:"goodwill_books",period:august,storeId:"GW-001"}));
  await assert.rejects(service.exportSupersetSnapshot({sourceId:"fedex",period:august,storeId:"__unknown__"}));
});

test("Superset export refuses metrics that drift to a different publication",async()=>{
  const original=env.reporting.query.bind(env.reporting);
  let calls=0;
  env.reporting.query=async(input,publicationId)=>{
    const response=await original(input,publicationId);
    calls++;
    return calls===2?{...response,result:{...response.result,publicationId:"different-publication"}}:response;
  };
  try {
    await assert.rejects(
      service.exportSupersetSnapshot({sourceId:"shopgoodwill",period:august}),
      (error:unknown)=>error instanceof Error&&error.message.includes("same immutable publication"),
    );
  } finally {
    env.reporting.query=original;
  }
});