/** Manual development-only smoke check. Does not seed, migrate or write data. */
import { pool } from "@workspace/db";
import { AnalyticsService } from "../../src/goodwill/analytics/service";
import { PostgresRepository, ReportingService, loadApprovedControls } from "../../src/goodwill/data";
import path from "node:path";
try{
  const root=path.resolve("docs/goodwill/evidence/github/goodwill/synthetic-data");
  const controls=await loadApprovedControls(root);
  const repository=new PostgresRepository(pool);
  const dashboard=await new AnalyticsService(repository,new ReportingService(repository,controls))
    .query({sourceId:"shopgoodwill",period:{startDate:"2026-08-01",endDate:"2026-08-31"}});
  console.log(JSON.stringify({synthetic:dashboard.synthetic,publicationExists:!!dashboard.publicationId,
    measures:dashboard.kpis.length,measured:dashboard.kpis.filter(k=>k.value!==null||k.points.length).length,
    sourceReports:dashboard.channels.length}));
  if(!dashboard.publicationId || dashboard.kpis.length!==34)throw new Error("Existing development publication was not verified.");
}finally{await pool.end();}