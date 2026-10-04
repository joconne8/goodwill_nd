import test from "node:test";
import assert from "node:assert/strict";
import {pool} from "@workspace/db";
import {PostgresRepository,tables} from "../../src/goodwill/data/postgres";
import {IntakeService,ReportingService,DataError,type Batch} from "../../src/goodwill/data";
import {hash} from "../../src/goodwill/data/normalize";
import {setup,file,august} from "./helpers";

test("real PostgreSQL metadata/staging/ledger survives adapter recreation, rolls back failures and holds a cross-connection lock",async()=>{
  const client=await pool.connect(),peer=await pool.connect();
  try{
    for(const table of tables)await client.query(`CREATE TEMP TABLE goodwill_v2_${table} (id text PRIMARY KEY,document jsonb NOT NULL)`);
    const connection={query:async(text:string,values?:unknown[])=>client.query(text,values),release(){}};
    const repository=new PostgresRepository({connect:async()=>connection}),other=new PostgresRepository({connect:async()=>connection});
    const env=await setup(),intake=new IntakeService({...env.intake.deps,repository});
    const bytes=await file("08_ebay_listing_sales_aug2026.csv");
    const ticket=await intake.requestUpload({sourceId:"ebay",reportType:"listing_sales",filename:"persist.csv",byteSize:bytes.length,checksum:hash(bytes)},"operator");
    env.archive.inbox.set(ticket.uploadId,bytes);
    const batch=await intake.createBatch({sourceId:"ebay",reportType:"listing_sales",period:august,inputKind:"upload",inputId:ticket.uploadId},"operator");
    assert.equal(batch.state,"published",JSON.stringify(batch.failure));
    assert.deepEqual(await other.transaction(tx=>tx.get<Batch>("batches",batch.id)),batch);
    const reporting=new ReportingService(other,env.controls);
    const q={sourceId:"ebay",metricId:"net_item_sales",period:august,groupBy:"none"};
    assert.equal((await reporting.query(q)).result.value,5551526);
    assert.equal((await reporting.batchRows(batch.id,10,5)).total,900);
    await assert.rejects(repository.transaction(async tx=>{
      await tx.put("heads","current",{id:"invalid-head"});
      throw new Error("injected rollback");
    }),/injected rollback/);
    assert.equal((await reporting.query(q)).result.publicationId,batch.publicationId);
    await repository.transaction(async tx=>{
      const head=await tx.get("heads","current");
      const lock=await peer.query("SELECT pg_try_advisory_xact_lock(hashtext('goodwill-data-v2')) AS acquired");
      assert.equal(lock.rows[0].acquired,false);
      await tx.put("audit","immutable-check",{a:1,b:2}); // JSONB key order must not falsely conflict.
      await tx.put("audit","immutable-check",{b:2,a:1});
      assert.deepEqual(await tx.get("heads","current"),head);
    });
    await assert.rejects(repository.transaction(tx=>tx.put("audit","immutable-check",{a:99,b:2})),{code:"IMMUTABLE_ID_CONFLICT"});
    await repository.transaction(async tx=>{
      await tx.put("batches","interrupted",{...batch,id:"interrupted",state:"received",publicationId:null});
    });
    const restarted=new IntakeService({...env.intake.deps,repository:other});
    await restarted.initialize();
    assert.equal((await other.transaction(tx=>tx.get<Batch>("batches","interrupted")))?.failure?.code,"INTERRUPTED");
    assert.equal((await reporting.query(q)).result.value,5551526);
  }finally{
    await client.query("ROLLBACK");
    for(const table of tables)await client.query(`DROP TABLE IF EXISTS pg_temp.goodwill_v2_${table}`);
    peer.release();client.release();await pool.end();
  }
});