import type { AnalyticsDashboard, AnalyticsKpi, AnalyticsScope, MetricQuery } from "@workspace/api-zod";
import {
  ExportGoodwillSupersetSnapshotBody, ExportGoodwillSupersetSnapshotResponse,
  QueryGoodwillAnalyticsBody, QueryGoodwillAnalyticsResponse,
} from "@workspace/api-zod";
import { current, recordsFor } from "../data/intake";
import { datasets } from "../data/catalog";
import { coverage, ReportingService } from "../data/reporting";
import { DataError, type Batch, type LedgerRecord, type Repository } from "../data/types";
import { businessSources } from "../assistant/overview";
import { hash, period } from "../data/normalize";
import { framework } from "./definitions";

const sum = (a:number[]) => {
  if(a.some(n=>!Number.isSafeInteger(n)))throw new DataError("UNSAFE_TOTAL","Analytical inputs must be exact safe integers.",503);
  const value=a.reduce((s,n)=>s+BigInt(n),0n);
  if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER))
    throw new DataError("UNSAFE_TOTAL","Analytical total exceeds the exact integer boundary.",503);
  return Number(value);
};
const day = (s:unknown) => {
  if(typeof s!=="string" || !s || !Number.isFinite(Date.parse(s))) return null;
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s));
};
const inPeriod = (s:string|null,p:AnalyticsScope["period"]) => !!s && s>=p.startDate && s<=p.endDate;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+"T12:00:00Z")) && new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
const unitCount=(r:LedgerRecord):number|null=>{
  const raw=r.values.quantity;
  // Single item grain is explicit in Upright and Jewelry; a statement is not an item.
  if(raw===undefined && ["upright","shopgoodwill"].includes(r.datasetId))return 1;
  if(!/^[1-9]\d*$/.test(String(raw)))return null;
  const n=Number(raw);return Number.isSafeInteger(n)&&n<=100000 ? n : null;
};
function groups(rows:LedgerRecord[],value:(r:LedgerRecord)=>number):{label:string;value:number}[] {
  const grouped=new Map<string,number[]>();
  for(const r of rows){const label=r.category??"Unattributed";grouped.set(label,[...(grouped.get(label)??[]),value(r)]);}
  return [...grouped].map(([label,a])=>({label,value:sum(a)})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
}
export class AnalyticsService {
  constructor(private repository:Repository,private reporting:ReportingService){}
  async exportSupersetSnapshot(input:unknown) {
    const parsed=ExportGoodwillSupersetSnapshotBody.strict().safeParse(input);
    if(!parsed.success)throw new DataError("INVALID_SUPERSET_SCOPE","Choose one supported source, a valid period and optional store.");
    const q=parsed.data;
    if(!validDate(q.period.startDate)||!validDate(q.period.endDate))
      throw new DataError("INVALID_PERIOD","Use valid chronological calendar dates.");
    period(q.period);
    const source=datasets.find(d=>d.sourceId===q.sourceId);
    if(!source||!["sales","statement","expense"].includes(source.role))
      throw new DataError("INVALID_SUPERSET_SOURCE","Only source-local sales, statement and expense data are supported.");
    if(q.storeId&&["fedex","goodwill_books"].includes(q.sourceId))
      throw new DataError("UNSUPPORTED_SUPERSET_STORE_SCOPE","This source has no approved store-level attribution.",400);
    const publication=await this.repository.transaction(current);
    if(!publication)throw new DataError("NO_PUBLICATION","No immutable publication exists for this scope.",503);

    const metricIds:MetricQuery["metricId"][]=[];
    if(source.role==="expense")metricIds.push("shipping_expense");
    else for(const metricId of ["net_item_sales","source_net","daily_customers"] as const)
      if(source.supportedMetrics.includes(metricId))metricIds.push(metricId);
    if(!metricIds.length)throw new DataError("NO_SUPPORTED_METRICS","This source has no supported Superset metrics.");
    const knownStoreIds=await this.repository.transaction(async tx=>
      new Set((await recordsFor(tx,publication)).filter(r=>r.datasetId==="stores").map(r=>String(r.values.store_id))));
    if(q.storeId&&q.storeId!=="__unknown__"&&!knownStoreIds.has(q.storeId))
      throw new DataError("UNKNOWN_STORE","The selected store is not in the published store catalog.",400);

    const exportedAt=new Date();
    const metrics=[];
    for(const metricId of metricIds) {
      const groupBy=source.role==="statement"?"none":"day";
      const query:MetricQuery={
        sourceId:q.sourceId,metricId,period:q.period,groupBy,
        ...(q.storeId?{storeId:q.storeId}:{})
      };
      const {result}=await this.reporting.query(query,publication.id);
      if(result.publicationId!==publication.id||result.publishedAt!==publication.at)
        throw new DataError("MIXED_PUBLICATION","Snapshot metrics did not resolve to the same immutable publication.",503);
      const hasData=result.value!==null||result.points.length>0;
      const partial=result.coverage.some(c=>c.status!=="complete")||result.warnings.length>0;
      metrics.push({
        metricId,
        label:result.definition.label,
        unit:result.definition.unit,
        definitionVersion:result.definition.version,
         formula:result.definition.formula.replace(/\bbuyer_id\b/gi,"customer identity").slice(0,500),
         grain:result.definition.grain.replace(/\bbuyer_id\b/gi,"platform-local customer identity").slice(0,200),
        timeBasis:result.definition.timeBasis.slice(0,200),
        availabilityReason:result.definition.availabilityReason?.slice(0,500)??null,
        status:!hasData?"unavailable":partial?"partial":"available",
        value:result.value,
        points:result.points.map(point=>({
          key:point.key.slice(0,80),value:point.value,
          contributingRows:point.contributingRows,missingBuyerRows:point.missingBuyerRows,
        })),
        coverage:result.coverage,
        warnings:result.warnings.slice(0,30).map(w=>w.slice(0,300)),
      });
    }
    const scopeId=hash(JSON.stringify({
      sourceId:q.sourceId,period:q.period,storeId:q.storeId??null,
    }));
    const base={
      schemaVersion:"goodwill-superset/1.0.0" as const,
      synthetic:true as const,
      scopeId,
      exportedAt:exportedAt.toISOString(),
      snapshotAgeSeconds:Math.max(0,Math.floor((exportedAt.getTime()-Date.parse(publication.at))/1000)),
      sourceId:q.sourceId,
      period:q.period,
      storeId:q.storeId??null,
      publicationId:publication.id,
      publishedAt:publication.at,
      timezone:"America/New_York" as const,
      currency:"USD" as const,
      metrics,
      warnings:[...new Set([
        "Synthetic aggregate only; checksum detects corruption but does not authenticate or certify completeness.",
        "One source/date/store scope per snapshot. Export a new scope to change filters; never combine overlapping scopes or snapshots.",
        ...(metrics.some(m=>m.metricId==="daily_customers")
          ?["Daily distinct customer counts are non-additive and are not period-unique buyers."]
          :[]),
        ...metrics.flatMap(m=>m.warnings),
      ])].slice(0,30).map(w=>w.slice(0,300)),
    };
    const checksum=hash(JSON.stringify(base));
    const snapshot=ExportGoodwillSupersetSnapshotResponse.parse({
      ...base,snapshotId:checksum,checksum,
    });
    if(Buffer.byteLength(JSON.stringify(snapshot),"utf8")>262144)
      throw new DataError("SNAPSHOT_TOO_LARGE","Aggregate snapshot exceeds the 256 KiB contract limit.");
    return snapshot;
  }
  async query(input:unknown):Promise<AnalyticsDashboard>{
    const parsed=QueryGoodwillAnalyticsBody.strict().safeParse(input);
    if(!parsed.success)throw new DataError("INVALID_ANALYTICS_SCOPE","Choose one known source, a valid period and optional store/snapshot.",400);
    const q=parsed.data;
    if(!validDate(q.period.startDate)||!validDate(q.period.endDate)||q.period.startDate>q.period.endDate)
      throw new DataError("INVALID_PERIOD","Use valid chronological calendar dates.",400);
    period(q.period);
    const snapshot=q.snapshotAt?.toISOString()??`${q.period.endDate}T23:59:59-04:00`;
    const frozen=await this.repository.transaction(async tx=>{
      const publication=await current(tx);
      const records=await recordsFor(tx,publication);
      const batches=await tx.list<Batch>("batches");
      return {publication,records,batches};
    });
    const {publication,records,batches}=frozen;
    const kpis=structuredClone(framework);
    const get=(id:string)=>kpis.find(k=>k.id===id)!;
    const fill=(id:string,value:number|null,points:AnalyticsKpi["points"],reason:string,partial=false)=>{
      const k=get(id); k.value=value;k.points=points;k.status=value===null && !points.length?"unavailable":partial?"partial":"available";k.reason=reason;
    };
    const knownStores=new Set(records.filter(r=>r.datasetId==="stores").map(r=>String(r.values.store_id)));
    if(q.storeId && q.storeId!=="__unknown__" && !knownStores.has(q.storeId))
      throw new DataError("UNKNOWN_STORE","The selected store is not in the published store catalog.",400);
    const store=(r:LedgerRecord)=>!q.storeId || (knownStores.has(r.storeId??"")?r.storeId:"__unknown__")===q.storeId;
    const d=datasets.find(d=>d.sourceId===q.sourceId)!;
    const c=coverage(d.id,publication,batches,q.period);
    const supported=!!publication && c.confirmedComplete && c.startDate!==null && c.endDate!==null &&
      q.period.startDate>=c.startDate && q.period.endDate<=c.endDate;
    const rows=records.filter(r=>r.sourceId===q.sourceId && r.datasetId===d.id && store(r) &&
      (d.role==="statement" ? r.month===q.period.startDate.slice(0,7) : inPeriod(r.date,q.period)));
    const saleRows=rows.filter(r=>r.netItemMinor!==null);
    const sourceScope=`${businessSources.find(s=>s.sourceId===q.sourceId)!.label}, ${q.period.startDate} to ${q.period.endDate}; source-local only.`;
    get("enterprise_revenue").reason="These inputs overlap and mix sales, settlements and expenses. No approved enterprise revenue mapping exists; see the separate source-local channel figures.";
    get("yoy_growth").reason="No comparable prior-year publication exists; no year-over-year trend is estimated.";
    for(const id of ["gross_margin","net_margin","profit_labor","category_margin","top_margin"])
      get(id).reason="Cost of goods, labor/overhead and approved cost allocation are absent. Payout/net proceeds are not profit.";
    for(const id of ["revenue_labor","listings_employee","sales_employee"])
      get(id).reason="Labor-hour and employee attribution/denominator data are absent.";
    get("donation_listing").reason="Catalog received_at is receipt time, not an actual donation timestamp. The COO measure cannot be inferred.";
    get("new_buyers").reason="The supplied buyer history does not establish first-ever purchases before this period.";
    get("relisted").reason="A relisted flag on sold transactions is not a complete active-inventory relisting denominator.";
    get("unsold").reason="Snapshots retain eligible unsold stock and omit sold exits; that is not the denominator for an unsold percentage.";
    get("sell_through").reason=get("category_sell").reason="No approved available-for-sale cohort/denominator is established; sales divided by current backlog is invalid.";
    for(const id of ["items_identified","items_sent"]) get(id).reason="Inventory states are not timestamped identification or transfer events for the selected period.";

    const evidence:MetricQuery={sourceId:q.sourceId,metricId:"net_item_sales",period:q.period,groupBy:"none",...(q.storeId?{storeId:q.storeId}:{})};
    const quantityReady=saleRows.every(r=>unitCount(r)!==null);
    const financialReady=supported && d.role==="sales" && d.id!=="amazon" && saleRows.length===rows.length;
    if(financialReady && quantityReady && saleRows.length){
      const units=sum(saleRows.map(r=>unitCount(r)!));
      const net=sum(saleRows.map(r=>r.netItemMinor!));
      fill("asp",net/units,[],sourceScope+" Net after refunds per reported unit; not gross asking price.");
      const price=saleRows.map(r=>({v:r.netItemMinor!/unitCount(r)!,n:unitCount(r)!})).sort((a,b)=>a.v-b.v);
      const at=(rank:number)=>{let seen=0;for(const p of price){seen+=p.n;if(rank<seen)return p.v;}throw new DataError("ANALYTICS_UNAVAILABLE","Median rank unavailable.",503);};
      const middle=(units-1)/2;fill("median_price",(at(Math.floor(middle))+at(Math.ceil(middle)))/2,[],sourceScope+" Quantity-weighted per-unit net price.");
      const catSales=groups(saleRows,r=>r.netItemMinor!);
      const catUnits=groups(saleRows,r=>unitCount(r)!);
      fill("category_units",units,catUnits,sourceScope+" Reported units, not unique orders.");
      fill("category_asp",null,catSales.map(p=>({label:p.label,value:p.value/catUnits.find(n=>n.label===p.label)!.value})),sourceScope+" Category net after refunds per reported unit.");
      for(const id of ["asp","median_price","category_units","category_asp"])get(id).evidenceQuery=evidence;
    }else{
      for(const id of ["asp","median_price","category_units","category_asp"])
        get(id).reason="Complete item-sale and quantity coverage is required; statements, settlement activity, missing quantity and unsupported periods are not converted into item prices.";
    }
    if(financialReady){
      const catSales=groups(saleRows,r=>r.netItemMinor!);
      fill("category_sales",sum(saleRows.map(r=>r.netItemMinor!)),catSales,sourceScope+" Net item sales; unattributed category remains explicit.");
      fill("top_revenue",null,catSales.slice(0,10),sourceScope+" Source-local category net item sales, not enterprise category revenue.");
      get("category_sales").evidenceQuery=get("top_revenue").evidenceQuery={...evidence,groupBy:"category"};
    }else for(const id of ["category_sales","top_revenue"])get(id).reason="Complete categorized item-sale coverage is unavailable for this source/period; statements and expenses are not category revenue.";

    if(supported && d.buyer && d.role==="sales"){
      const buyerRows=rows.filter(r=>r.buyerId);
      const missing=rows.length-buyerRows.length;
      const buyers=new Set(buyerRows.map(r=>r.buyerId!));
      fill("buyers",buyers.size,[],sourceScope+` Known platform-local buyer identities only; ${missing} rows have missing buyers.`,missing>0);
      get("buyers").evidenceQuery={...evidence,metricId:"daily_customers",groupBy:"day"};
      const orderKey=d.id==="upright"?"paid_order_id":d.id==="ebay"?"transaction_id":"order_id";
      if(buyerRows.every(r=>!!r.values[orderKey])){
        const orders=new Map<string,Set<string>>();
        for(const r of buyerRows){const set=orders.get(r.buyerId!)??new Set<string>();set.add(String(r.values[orderKey]));orders.set(r.buyerId!,set);}
        fill("repeat_buyers",buyers.size?100*[...orders.values()].filter(s=>s.size>1).length/buyers.size:null,[],
          sourceScope+` Period-only repeat distinct ${orderKey} identities, not lifetime/new-buyer status; ${missing} rows excluded for unknown buyers.`,true);
        get("repeat_buyers").evidenceQuery=get("buyers").evidenceQuery;
      }
    }else get("buyers").reason=get("repeat_buyers").reason="Complete platform-local buyer/order identities are unavailable for this scope; settlement counts or row counts are not buyers.";

    // Operational calculations remain bounded to the complete approved catalog.
    const catalogCoverage=coverage("catalog",publication,batches);
    const catalog=records.filter(r=>r.datasetId==="catalog"&&r.platform===q.sourceId&&store(r));
    if(catalogCoverage.confirmedComplete && ["shopgoodwill","ebay"].includes(q.sourceId)){
      const durations=(end:"listed_at"|"sold_at",start:"received_at"|"listed_at")=>{
        const eligible=catalog.filter(r=>inPeriod(day(r.values[end]),q.period));
        if(!eligible.length)return null;
        const ds=eligible.map(r=>(Date.parse(String(r.values[end]))-Date.parse(String(r.values[start])))/86400000);
        return ds.every(n=>Number.isFinite(n)&&n>=0)?ds.reduce((a,b)=>a+b,0)/ds.length:null;
      };
      fill("time_to_list",durations("listed_at","received_at"),[],"Complete supplied catalog cohort listed during selected period. Receipt-to-listing proxy, not donation-to-listing.",true);
      fill("days_sell",durations("sold_at","listed_at"),[],"Complete supplied catalog cohort sold during selected period; catalog sample cohort, not all marketplace transactions.",true);
    }
    const operationalQuery:MetricQuery={...evidence,metricId:"listings",groupBy:"day"};
    if(publication && ["shopgoodwill","ebay"].includes(q.sourceId)){
      const {result:listing}=await this.reporting.query(operationalQuery,publication.id);
      const lc=listing.coverage.find(c=>c.datasetId==="listings");
      if(lc?.status==="complete" && lc.startDate && lc.endDate && q.period.startDate>=lc.startDate && q.period.endDate<=lc.endDate){
        fill("listings_daily",null,listing.points.map(p=>({label:p.key,value:p.value})),"Distinct new listing events by Eastern day; days without events are not fabricated.");
        fill("listings_created",listing.value,[],"Distinct new platform/listing IDs in selected period.");
        get("listings_daily").evidenceQuery=get("listings_created").evidenceQuery=operationalQuery;
      }
      if(inPeriod(day(snapshot),q.period)){
        const backlogQuery:MetricQuery={...evidence,metricId:"backlog",groupBy:"none",snapshotAt:new Date(snapshot)};
        const {result:backlog}=await this.reporting.query({...backlogQuery,snapshotAt:snapshot},publication.id);
        fill("backlog",backlog.value,[],backlog.value===null?backlog.definition.availabilityReason??"Complete snapshot unavailable.":`Complete validated snapshot at ${snapshot}; stock as-of, not a period flow.`);
        if(backlog.value!==null)get("backlog").evidenceQuery=backlogQuery;
      }else get("backlog").reason="The selected inventory snapshot must fall inside this report period.";
    }
    const channels:AnalyticsDashboard["channels"]=[];
    for(const source of businessSources){
      const sd=datasets.find(d=>d.sourceId===source.sourceId)!;
      const sc=coverage(sd.id,publication,batches,q.period);
      const covered=!!publication&&sc.confirmedComplete&&!!sc.startDate&&!!sc.endDate&&q.period.startDate>=sc.startDate&&q.period.endDate<=sc.endDate;
      const fullMonth=q.period.startDate.endsWith("-01")&&q.period.startDate.slice(0,7)===q.period.endDate.slice(0,7)&&
        new Date(Date.parse(q.period.endDate+"T12:00:00Z")+86400000).getUTCDate()===1;
      const rr=records.filter(r=>r.datasetId===sd.id&&store(r)&&(sd.role==="statement"?r.month===q.period.startDate.slice(0,7):inPeriod(r.date,q.period)));
      const itemEligible=covered&&sd.role==="sales"&&sd.id!=="amazon"&&rr.every(r=>r.netItemMinor!==null);
      const isExpense=sd.role==="expense";
      const storeUnavailable=!!q.storeId && q.storeId!=="__unknown__" && ["fedex","goodwill_books"].includes(sd.id);
      const value=covered&&!storeUnavailable&&(sd.role!=="statement"||fullMonth)
        ?sum(rr.map(r=>isExpense?r.expenseMinor??0:itemEligible?r.netItemMinor!:r.sourceNetMinor??0)):null;
      const known=rr.filter(r=>r.buyerId);
      const single=q.period.startDate===q.period.endDate;
      const customerReason=single?(sd.buyer?"Distinct known source-local buyers for this day; unknown buyer rows excluded.":"This source has no usable buyer identity."):"Select one day for nightly customers; period buyer counts are not sums of daily unique buyers.";
      const dateGroups=new Map<string,number[]>();
      if(covered && sd.role!=="statement")for(const r of rr){if(r.date){const a=dateGroups.get(r.date)??[];a.push(isExpense?r.expenseMinor??0:itemEligible?r.netItemMinor!:r.sourceNetMinor??0);dateGroups.set(r.date,a);}}
      channels.push({sourceId:source.sourceId,label:source.label,revenue:value,
        revenueLabel:isExpense?"Shipping expense":itemEligible?"Net item sales":"Source-local net proceeds",
        customers:covered&&single&&!!sd.buyer?new Set(known.map(r=>r.buyerId)).size:null,customerReason,
        reason:!covered?"No complete published coverage for the selected period.":sd.role==="statement"&&!fullMonth?"Statement-month grain requires the complete month.":storeUnavailable?"This source has no approved store-level attribution.":`Separate ${sd.timeBasis}; never summed with overlapping inputs. ${rr.length-known.length} rows lack buyer identity.`,
        points:value===null?[]:[...dateGroups].sort(([a],[b])=>a.localeCompare(b)).map(([label,a])=>({label,value:sum(a)}))});
    }
    const stale=batches.filter(b=>publication?.batchIds.includes(b.id)).map(b=>b.datasetId)
      .filter(id=>coverage(id,publication,batches).status==="stale");
    if(c.status==="stale")for(const k of kpis)if(k.status==="available"){k.status="partial";k.reason+=" Retained last-good records: a newer attempt failed or was quarantined.";}
    const result:AnalyticsDashboard={query:{...q,snapshotAt:new Date(snapshot)},publicationId:publication?.id??null,publishedAt:publication?new Date(publication.at):null,
      synthetic:true,timezone:"America/New_York",kpis,channels,batchIds:publication?.batchIds??[],
      warnings:["Synthetic data only. No enterprise additive revenue or cross-marketplace unique customer total.",
        "A source payout is not profit. Missing labor, cost, survey, visitor and prior-year inputs are not inferred.",
        "Targets and prior-year trend context are unavailable until approved supporting data is supplied.",
        ...(stale.length?["Some published inputs are retained last-good after a failed/quarantined newer attempt: "+[...new Set(stale)].join(", ")+"."]:[]),
        ...(supported?[]:["The selected source lacks complete period coverage; partial financial estimates are withheld."])]};
    QueryGoodwillAnalyticsResponse.parse(result);return result;
  }
}