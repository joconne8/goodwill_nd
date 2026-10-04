import { Router, type Request, type Response, type IRouter } from "express";
import { QueryGoodwillEvidenceBody } from "@workspace/api-zod";
import { DataError, type Batch } from "./types";
import { IntakeService } from "./intake";
import { ReportingService, paginate, querySchema } from "./reporting";
import { exportCsv } from "./export";

/** Mandatory injected authorization; no permissive default and no standalone login bypass. */
export function createDataRouter(intake:IntakeService, reporting:ReportingService, authorize:(request:Request)=>Promise<string|null>):IRouter {
  const router=Router();
  router.use(async(req,res,next)=>{
    try {
      const operator=await authorize(req);
      if (!operator) { res.status(401).json({code:"OPERATOR_AUTH_REQUIRED",message:"Authorized operator sign-in is required.",retainedPrevious:true}); return; }
      res.locals.operator=operator; next();
    } catch { res.status(503).json({code:"AUTH_UNAVAILABLE",message:"Operator authorization is unavailable.",retainedPrevious:true}); }
  });
  const handle=(fn:(req:Request,res:Response)=>Promise<unknown>)=>async(req:Request,res:Response)=>{
    try { res.json(await fn(req,res)); }
    catch(e) {
      const error=e instanceof DataError ? e : new DataError("STORAGE_UNAVAILABLE","Data service is unavailable; last-good remains retained.",503);
      res.status(error.status).json({code:error.code,message:error.message,retainedPrevious:true});
    }
  };
  router.get("/catalog",handle(()=>reporting.catalog()));
  router.post("/uploads",handle((req,res)=>intake.requestUpload(req.body,res.locals.operator)));
  router.post("/batches",handle((req,res)=>intake.createBatch(req.body,res.locals.operator)));
  router.get("/batches",handle(async req=>{
    const {offset,limit}=paginate(req.query.offset===undefined ? 0 : Number(req.query.offset),req.query.limit===undefined ? 100 : Number(req.query.limit));
    if (Object.keys(req.query).some(k=>!["offset","limit","sourceId","state"].includes(k))) throw new DataError("INVALID_FILTER","Unknown batch filter.");
    if(req.query.state && !["received","validated","reconciled","published","partial","duplicate","quarantined","failed","superseded"].includes(String(req.query.state)))
      throw new DataError("INVALID_STATE","Unknown batch state.");
    const items=await intake.deps.repository.transaction(tx=>tx.list<Batch>("batches"));
    const filtered=items.filter(b=>(!req.query.sourceId||b.sourceId===req.query.sourceId)&&(!req.query.state||b.state===req.query.state))
      .sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt)||b.id.localeCompare(a.id));
    return {items:filtered.slice(offset,offset+limit),total:filtered.length,offset,limit};
  }));
  router.get("/batches/:batchId",handle(async req=>{
    const batch=await intake.deps.repository.transaction(tx=>tx.get<Batch>("batches",String(req.params.batchId)));
    if(!batch) throw new DataError("BATCH_NOT_FOUND","Unknown batch.",404); return batch;
  }));
  router.get("/batches/:batchId/rows",handle(req=>reporting.batchRows(String(req.params.batchId),
    req.query.offset===undefined ? 0 : Number(req.query.offset),req.query.limit===undefined ? 100 : Number(req.query.limit),
    req.query.disposition===undefined ? undefined : String(req.query.disposition))));
  router.post("/batches/:batchId/review",handle((req,res)=>intake.review(String(req.params.batchId),req.body,res.locals.operator)));
  router.post("/metrics/query",handle(async req=>(await reporting.query(req.body)).result));
  router.post("/evidence/query",handle(req=>{
    const parsed=QueryGoodwillEvidenceBody.strict().extend({query:querySchema}).safeParse(req.body);
    if(!parsed.success) throw new DataError("INVALID_EVIDENCE_QUERY","Evidence requires a query, publication and bounded pagination.");
    return reporting.evidence(parsed.data);
  }));
  router.post("/exports",handle(req=>exportCsv(reporting,req.body)));
  return router;
}