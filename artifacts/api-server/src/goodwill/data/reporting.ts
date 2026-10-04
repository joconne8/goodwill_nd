import { QueryGoodwillMetricsBody } from "@workspace/api-zod";
import { datasets, metricDefinitions } from "./catalog";
import { current, recordsFor } from "./intake";
import { DataError, type Batch, type Controls, type LedgerRecord, type Publication, type Query, type Repository, type Tx } from "./types";
import { day, instant, period, sum } from "./normalize";
import { wireValues, wireReasons } from "./wire";

export const querySchema = QueryGoodwillMetricsBody.strict().extend({
  period: QueryGoodwillMetricsBody.shape.period.strict(), snapshotAt: QueryGoodwillMetricsBody.shape.sourceId.optional(),
});
export function parseQuery(input: unknown): Query {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) throw new DataError("INVALID_QUERY","Use one supported metric/source with valid filters.");
  const q = parsed.data; period(q.period);
  if (!datasets.some(d=>d.sourceId===q.sourceId && ["sales","expense","statement"].includes(d.role)))
    throw new DataError("INVALID_SOURCE","Select exactly one business source; no all-sources total exists.");
  if (q.storeId !== undefined && q.storeId !== "__unknown__" && !/^GW-\d{3}$/.test(q.storeId)) throw new DataError("INVALID_STORE","Invalid store filter.");
  if (q.metricId === "backlog" && !q.snapshotAt) throw new DataError("SNAPSHOT_REQUIRED","Select exactly one snapshot.");
  if (q.snapshotAt) {
    const cutoffDay = day(instant(q.snapshotAt));
    if (q.metricId !== "backlog" || cutoffDay < q.period.startDate || cutoffDay > q.period.endDate)
      throw new DataError("INVALID_SNAPSHOT","Snapshot must belong to the selected period and backlog metric.");
    if (q.groupBy === "day") throw new DataError("SNAPSHOT_NOT_DAILY","Backlog is one selected instant, not a daily aggregate.");
  }
  if (q.metricId === "daily_customers" && q.period.startDate !== q.period.endDate && q.groupBy !== "day")
    throw new DataError("DAILY_CUSTOMERS_GROUPING","Multi-day customer queries require daily points, not period/store unique customers.");
  return q;
}
export function paginate(offset = 0, limit = 100) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500)
    throw new DataError("INVALID_PAGINATION","Offset must be nonnegative; limit must be 1..500.");
  return {offset,limit};
}
const unknown = "__unknown__";
function coverage(did: string, pub: Publication | null, batches: Batch[], completePeriod?: Query["period"]) {
  const good = batches.filter(b=>b.datasetId===did && pub?.batchIds.includes(b.id));
  const latest = batches.filter(b=>b.datasetId===did).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))[0];
  let complete = good.some(b=>b.coverageComplete);
  if (completePeriod) {
    for (let t = Date.parse(completePeriod.startDate); t <= Date.parse(completePeriod.endDate); t += 86400000) {
      const date = new Date(t).toISOString().slice(0,10);
      if (!good.some(b=>b.coverageComplete && b.period.startDate<=date && b.period.endDate>=date)) complete = false;
    }
  }
  const stale = !!good.length && !!latest && ["quarantined","failed"].includes(latest.state);
  return {datasetId:did,status:!good.length ? latest && latest.state==="failed" ? "failed" as const : "missing" as const : stale ? "stale" as const : complete ? "complete" as const : "partial" as const,
    startDate:good.length ? good.map(b=>b.period.startDate).sort()[0] : null,endDate:good.length ? good.map(b=>b.period.endDate).sort().at(-1)! : null,
    lastGoodAt:good.map(b=>b.publishedAt!).filter(Boolean).sort().at(-1) ?? null,latestAttemptAt:latest?.receivedAt ?? null,missingRows:null as number|null,
    reason:!good.length ? "No published input for this dataset." : stale ? "Latest attempt failed/quarantined; showing retained last-good records." : complete ? "Complete approved synthetic input coverage." : "Only observed rows are covered; missing periods/rows are not inferred.",
    confirmedComplete:complete};
}
export class ReportingService {
  constructor(private repository: Repository, private controls: Controls) {}
  async catalog() {
    return this.repository.transaction(async tx => {
      const pub=await current(tx), records=await recordsFor(tx,pub), batches=await tx.list<Batch>("batches");
      return {contractVersion:"2.0.0",synthetic:true,
        datasets:datasets.map(d=>({id:d.id,sourceId:d.sourceId,reportType:d.reportType,filename:d.filename,role:d.role,
          grain:d.keyFields.join(" + "),timeBasis:d.timeBasis,keyFields:d.keyFields,monetaryFields:d.monetaryFields,supportedMetrics:d.supportedMetrics,coverage:this.wireCoverage(coverage(d.id,pub,batches))})),
        metrics:metricDefinitions,stores:records.filter(r=>r.datasetId==="stores").map(r=>({id:String(r.values.store_id),name:String(r.values.store_name),district:String(r.values.district)}))};
    });
  }
  async query(input: unknown, publicationId?: string) {
    const q=parseQuery(input);
    return this.repository.transaction(tx=>this.evaluate(tx,q,publicationId));
  }
  private wireCoverage({confirmedComplete:_complete,...wire}:ReturnType<typeof coverage>) { return wire; }
  private async evaluate(tx: Tx, q: Query, publicationId?: string) {
    const pub=publicationId ? await tx.get<Publication>("publications",publicationId) : await current(tx);
    if (publicationId && !pub) throw new DataError("PUBLICATION_NOT_FOUND","Immutable publication does not exist.",404);
    const records=await recordsFor(tx,pub), batches=await tx.list<Batch>("batches");
    const d=datasets.find(d=>d.sourceId===q.sourceId)!, def={...metricDefinitions.find(m=>m.id===q.metricId)!,
      grain:q.metricId==="daily_customers" ? "source + Eastern day + buyer_id" : q.metricId==="listings" ? "platform + listing_id" : q.metricId==="backlog" ? "selected snapshot + catalog item" : d.keyFields.join(" + "),
      timeBasis:d.timeBasis,availabilityReason:null as string|null,requiredDatasets:[q.metricId==="backlog" ? "inventory" : q.metricId==="listings" ? "listings" : d.id,...(q.metricId==="backlog" ? ["catalog"] : [])]};
    let reason: string|null = null, selected: LedgerRecord[] = [], datasetIds=[d.id], warnings:string[]=[], snapshotComplete=false;
    const stores=new Set(records.filter(r=>r.datasetId==="stores").map(r=>String(r.values.store_id)));
    const store=(r:LedgerRecord)=>r.storeId && stores.has(r.storeId) ? r.storeId : unknown;
    const filterStore=(r:LedgerRecord)=>q.storeId===undefined || store(r)===q.storeId;
    if(q.metricId==="source_net" && d.plus)def.formula=`${d.net} = ${d.plus.join(" + ")}${d.minus?.length ? " - "+d.minus.join(" - ") : ""}`;
    if(q.metricId==="net_item_sales")def.formula=`${d.gross??"unavailable gross"} - ${d.refund??"unavailable item refund"}`;
    if(q.metricId==="shipping_expense")def.formula=d.id==="shipping" ? "postage_amount + signed adjustment_amount" : "charge_amount - refund_amount";
    if(q.metricId==="listings")def.timeBasis="listed_at in America/New_York; supplied June/July history retained";
    if(q.metricId==="backlog")def.timeBasis="one explicitly selected snapshot instant in the complete declared catalog universe";
    if (q.metricId==="listings" || q.metricId==="backlog") {
      datasetIds=q.metricId==="listings" ? ["listings"] : ["inventory","catalog"];
      if (!["shopgoodwill","ebay"].includes(q.sourceId)) reason="Operational datasets cover only ShopGoodwill/eBay.";
      else if (q.metricId==="listings") selected=records.filter(r=>r.datasetId==="listings" && r.platform===q.sourceId && r.date!>=q.period.startDate && r.date!<=q.period.endDate);
      else {
        const cutoff=Date.parse(q.snapshotAt!), catalog=records.filter(r=>r.datasetId==="catalog");
        const controls=Object.entries(this.controls.inventory_controls).find(([at])=>Date.parse(at)===cutoff)?.[1];
        const allSnapshot=records.filter(r=>r.datasetId==="inventory" && Date.parse(String(r.values.snapshot_at))===cutoff);
        const catalogByItem=new Map(catalog.map(r=>[String(r.values.item_id),r]));
        const eligible=catalog.filter(r=>Date.parse(String(r.values.received_at))<=cutoff &&
          (!r.values.sold_at || Date.parse(String(r.values.sold_at))>cutoff ||
            !!r.values.canceled_at && Date.parse(String(r.values.canceled_at))<=cutoff));
        const expected=new Set(eligible.map(r=>String(r.values.item_id))), actual=new Set(allSnapshot.map(r=>String(r.values.item_id)));
        const universe=coverage("catalog",pub,batches);
        if (!controls || !catalog.length || catalogByItem.size!==catalog.length || !universe.confirmedComplete ||
          actual.size!==expected.size || [...expected].some(id=>!actual.has(id)) || allSnapshot.length!==actual.size ||
          allSnapshot.length!==controls.total_inventory || allSnapshot.filter(r=>r.values.workflow_state!=="listed").length!==controls.unlisted_backlog)
          reason="Selected snapshot is missing, partial or outside the complete approved catalog/control universe.";
        else {
          snapshotComplete=true;
          selected=allSnapshot.filter(r=>catalogByItem.get(String(r.values.item_id))?.platform===q.sourceId && r.values.workflow_state!=="listed")
            .map(r=>({...r,category:catalogByItem.get(String(r.values.item_id))?.category??null}));
        }
      }
    } else if (!d.supportedMetrics.includes(q.metricId)) reason="Metric is unavailable from this source grain; no values are invented.";
    else if (d.role==="statement" && (q.groupBy==="day" || q.period.startDate.slice(8)!=="01" ||
      q.period.startDate.slice(0,7)!==q.period.endDate.slice(0,7) ||
      q.period.endDate!==new Date(Date.UTC(Number(q.period.startDate.slice(0,4)),Number(q.period.startDate.slice(5,7)),0)).toISOString().slice(0,10)))
      reason="Books requires a complete statement-month query, not daily payment-date allocation.";
    else if (q.sourceId==="fedex" && q.storeId && q.storeId!==unknown) reason="FedEx has no approved store attribution.";
    else selected=records.filter(r=>r.datasetId===d.id && (r.month ? r.month===q.period.startDate.slice(0,7) : r.date!>=q.period.startDate && r.date!<=q.period.endDate));
    selected=selected.filter(filterStore);
    if (q.storeId && q.storeId!==unknown && !stores.has(q.storeId)) reason="Selected store is unavailable in the published store dimension.";
    const cov=datasetIds.map(id=>coverage(id,pub,batches,["catalog","inventory"].includes(id) ? undefined : q.period));
    if (!reason && !pub) reason="No immutable publication exists.";
    if (!reason && cov.some(c=>["missing","failed"].includes(c.status))) reason="Required dataset has no published coverage.";
    if (!reason && !selected.length && !snapshotComplete && cov.some(c=>!c.confirmedComplete)) reason="No observed rows; incomplete coverage cannot prove zero.";
    const missing=selected.filter(r=>!r.buyerId).length;
    if (q.metricId==="daily_customers" && missing) {
      warnings.push(`${missing} missing buyer rows; distinct counts are observed lower bounds.`);
      cov[0]={...cov[0],status:"partial",missingRows:missing,reason:"Missing buyers cannot be inferred."};
    }
    if(q.metricId==="daily_customers" && q.groupBy!=="none" && q.groupBy!=="day")warnings.push("Distinct customers in store/category points are not additive; aggregate is deduplicated within the selected source/day.");
    if (selected.some(r=>store(r)===unknown)) warnings.push("Unresolved attribution remains in __unknown__; no hidden store inference.");
    if (selected.some(r=>r.warnings.includes("UNCONFIRMED_SUPPLIER"))) warnings.push("Unconfirmed jewelry supplier retained and flagged.");
    if (q.sourceId==="amazon") warnings.push("Posted financial activity only; not order-day customers or attributed sales.");
    if (q.sourceId==="goodwill_books") warnings.push("Statement-month activity only; September payment is not September item sales.");
    if (cov.some(c=>c.status==="stale")) warnings.push("Failed latest attempt; retained last-good values.");
    const metricValue=(r:LedgerRecord)=>q.metricId==="net_item_sales" ? r.netItemMinor! : q.metricId==="source_net" ? r.sourceNetMinor! : q.metricId==="shipping_expense" ? r.expenseMinor! : 1;
    const key=(r:LedgerRecord)=>q.groupBy==="day" ? r.date! : q.groupBy==="store" ? store(r) : q.groupBy==="category" ? r.category ?? unknown : "total";
    const groups=new Map<string,LedgerRecord[]>();
    if (!reason) for(const r of selected) groups.set(key(r),[...(groups.get(key(r))??[]),r]);
    if (!reason && q.groupBy==="none" && !groups.size)groups.set("total",[]);
    // Explicit zeros only for complete day coverage; no missing-period zeros.
    if (!reason && q.groupBy==="day" && cov.every(c=>c.confirmedComplete))
      for(let t=Date.parse(q.period.startDate);t<=Date.parse(q.period.endDate);t+=86400000) {
        const k=new Date(t).toISOString().slice(0,10); if(!groups.has(k)) groups.set(k,[]);
      }
    const points=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,rs])=>({key,
      value:q.metricId==="daily_customers" ? new Set(rs.filter(r=>r.buyerId).map(r=>r.buyerId)).size : sum(rs.map(metricValue)),
      contributingRows:rs.length,missingBuyerRows:q.metricId==="daily_customers" ? rs.filter(r=>!r.buyerId).length : 0}));
    const value=reason || q.metricId==="daily_customers" && q.period.startDate!==q.period.endDate ? null :
      q.metricId==="daily_customers" ? new Set(selected.filter(r=>r.buyerId).map(r=>r.buyerId)).size : sum(selected.map(metricValue));
    def.availabilityReason=reason;
    if(reason) warnings.push(reason);
    const usesStores=!!q.storeId || q.groupBy==="store" || selected.some(r=>r.storeId!==null);
    const dimensionCoverage=usesStores ? [coverage("stores",pub,batches)] : [];
    const supplementalRecords=records.filter(r=>q.metricId==="backlog" && r.datasetId==="catalog" || usesStores && r.datasetId==="stores");
    // Include completeness inputs even for a proven zero, and supporting dimension/universe provenance.
    const coverageBatchIds=batches.filter(b=>pub?.batchIds.includes(b.id) && datasetIds.includes(b.datasetId) &&
      (["inventory","catalog"].includes(b.datasetId) || b.period.startDate<=q.period.endDate && b.period.endDate>=q.period.startDate)).map(b=>b.id);
    const result={query:q,definition:def,publicationId:pub?.id ?? null,publishedAt:pub?.at ?? null,value,points,coverage:[...cov,...dimensionCoverage].map(c=>this.wireCoverage(c)),
      batchIds:[...new Set([...selected.map(r=>r.batchId),...coverageBatchIds,...supplementalRecords.map(r=>r.batchId)])],warnings,currency:"USD",timezone:"America/New_York",synthetic:true,contractVersion:"2.0.0"};
    const evidence=reason ? [] : selected.map(r=>({recordId:r.id,sourceId:r.sourceId,batchId:r.batchId,runId:r.runId,artifactId:r.artifactId,
      checksum:r.checksum,sourceRow:r.sourceRow,disposition:"accepted" as const,values:wireValues({...r.values,
        metricId:q.metricId,definitionVersion:def.version,metricValue:q.metricId==="daily_customers" && !r.buyerId ? null : metricValue(r),
        distinctKey:q.metricId==="daily_customers" ? r.buyerId ? `${q.sourceId}|${r.date}|${r.buyerId}` : null : r.key,
        effectiveStore:store(r),effectiveCategory:r.category,moneyUnit:"usd_cent"}),reasons:wireReasons(r.warnings)}));
    return {result,evidence};
  }
  async evidence(input: {query:unknown; publicationId:string;offset:number;limit:number}) {
    const {offset,limit}=paginate(input.offset,input.limit), {evidence}=await this.query(input.query,input.publicationId);
    return {items:evidence.slice(offset,offset+limit),total:evidence.length,offset,limit,publicationId:input.publicationId};
  }
  async batchRows(batchId:string,offset=0,limit=100,disposition?:string) {
    paginate(offset,limit);
    if(disposition && !["accepted","rejected","duplicate"].includes(disposition)) throw new DataError("INVALID_DISPOSITION","Unknown row disposition.");
    return this.repository.transaction(async tx=>{
      const batch=await tx.get<Batch>("batches",batchId);
      if(!batch) throw new DataError("BATCH_NOT_FOUND","Unknown batch.",404);
      const rows=(await tx.list<import("./types").StagedRow>("rows")).filter(r=>r.batchId===batchId && (!disposition||r.disposition===disposition)).sort((a,b)=>a.sourceRow-b.sourceRow);
      return {items:rows.slice(offset,offset+limit).map(r=>({recordId:r.record?.id??r.id,sourceId:batch.sourceId,batchId,
        runId:batch.runId,artifactId:batch.artifact!.artifactId,checksum:batch.artifact!.checksum,sourceRow:r.sourceRow,
        disposition:r.disposition,values:wireValues({...r.values,valueEncoding:r.record ? "normalized" : "original_source_cells",
          moneyUnit:r.record ? "usd_cent" : "unvalidated_source_decimal_usd"}),reasons:wireReasons(r.reasons)})),total:rows.length,offset,limit,publicationId:batch.publicationId};
    });
  }
}