import { Router } from "express";
import { DataError } from "../data/types";
import type { AnalyticsService } from "./service";
/** Mounted behind the unchanged runtime exact-operator authorization. */
export function createAnalyticsRouter(service:AnalyticsService,authorize:(request:import("express").Request)=>Promise<string|null>){
  const router=Router();
  router.post("/analytics/query",async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    try { res.json(await service.query(req.body)); }
    catch(e){const error=e instanceof DataError?e:new DataError("ANALYTICS_UNAVAILABLE","Analytical publication could not be verified. No estimates are returned.",503);
      res.status(error.status).json({code:error.code,error:error.message,retainedPrevious:true});}
  });
  router.post("/analytics/superset-snapshot",async(req,res)=>{
    res.setHeader("Cache-Control","private, no-store");
    try {
      if(!await authorize(req)){
        res.status(401).json({code:"OPERATOR_AUTH_REQUIRED",message:"Authorized operator sign-in is required.",retainedPrevious:true});
        return;
      }
      const snapshot=await service.exportSupersetSnapshot(req.body);
      res.setHeader("Content-Disposition",`attachment; filename="goodwill-superset-${snapshot.sourceId}-${snapshot.period.startDate}-${snapshot.period.endDate}.json"`);
      res.type("application/json").json(snapshot);
    } catch(e) {
      const error=e instanceof DataError?e:new DataError("SNAPSHOT_UNAVAILABLE","Snapshot could not be verified; no new export was produced.",503);
      res.status(error.status).json({code:error.code,message:error.message,retainedPrevious:true});
    }
  });
  return router;
}