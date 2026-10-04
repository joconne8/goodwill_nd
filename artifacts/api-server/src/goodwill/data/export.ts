import { hash } from "./normalize";
import { DataError } from "./types";
import { querySchema, type ReportingService } from "./reporting";
import { ExportGoodwillReportBody } from "@workspace/api-zod";

export function csvCell(value: unknown) {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new DataError("UNSAFE_EXPORT_NUMBER","CSV numeric values must be safe integers.");
    text=String(value);
  } else {
    text=value===null || value===undefined ? "" : String(value);
    if (/^[=+\-@\t\r\n]/.test(text)) text="'"+text;
  }
  return `"${text.replaceAll('"','""')}"`;
}
const csv=(rows:unknown[][])=>rows.map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
export async function exportCsv(reporting:ReportingService,input:unknown) {
  const parsed=ExportGoodwillReportBody.strict().extend({query:querySchema.optional()}).safeParse(input);
  if (!parsed.success) throw new DataError("INVALID_EXPORT","Invalid export request.");
  const body=parsed.data;
  if (body.kind==="rejections" ? !body.batchId || body.query || body.publicationId : !body.query || !body.publicationId || body.batchId)
    throw new DataError("INVALID_EXPORT_COMBINATION","Summary/evidence requires query + publication; rejections requires only batch ID.");
  let text:string;
  if(body.kind==="rejections") {
    const first=await reporting.batchRows(body.batchId!,0,500,"rejected"), rows=[...first.items];
    for(let offset=500;offset<first.total;offset+=500) rows.push(...(await reporting.batchRows(body.batchId!,offset,500,"rejected")).items);
    text=csv([["synthetic","source","batch","artifact","checksum","source_data_row","disposition","reasons","row_values_json"],
      ...rows.map(r=>["true",r.sourceId,r.batchId,r.artifactId,r.checksum,r.sourceRow,r.disposition,r.reasons.map(x=>x.code).join(";"),JSON.stringify(r.values)])]);
  } else {
    const {result,evidence}=await reporting.query(body.query!,body.publicationId);
    const labels=["true",body.query!.sourceId,body.query!.period.startDate,body.query!.period.endDate,result.definition.id,result.definition.version,
      result.definition.unit,body.publicationId,result.coverage.map(c=>`${c.datasetId}:${c.status}`).join(";"),result.warnings.join(";")];
    const headers=["synthetic","source","start_date","end_date","metric","definition_version","unit","publication","coverage","warnings"];
    text=body.kind==="summary" ? csv([[...headers,"key","value","contributing_rows","missing_buyer_rows"],
      ...result.points.map(p=>[...labels,p.key,p.value,p.contributingRows,p.missingBuyerRows]),
      ...(result.points.length ? [] : [[...labels,result.definition.availabilityReason ? "unavailable" : "aggregate",result.value,0,0]])]) :
      csv([[...headers,"batch","artifact","checksum","source_data_row","distinct_key","metric_value","values_json_money_in_cents"],
        ...evidence.map(r=>[...labels,r.batchId,r.artifactId,r.checksum,r.sourceRow,r.values.distinctKey,
          r.values.metricValue==="" ? null : Number(r.values.metricValue),JSON.stringify(r.values)])]);
  }
  return {filename:`synthetic-goodwill-${body.kind}.csv`,contentType:"text/csv" as const,csv:text,checksum:hash(text),synthetic:true,
    publicationId:body.publicationId ?? null};
}