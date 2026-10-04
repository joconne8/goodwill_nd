import type { AnalyticsKpi } from "@workspace/api-zod";

type Area = AnalyticsKpi["area"];
type Unit = AnalyticsKpi["unit"];
const coo = new Set(["enterprise_revenue","yoy_growth","net_margin","listings_created","revenue_labor","listings_employee","donation_listing","backlog","unsold","asp","sell_through","sales_employee","top_revenue","top_margin","repeat_buyers"]);
const plan = new Set(["net_margin","revenue_labor","sell_through"]);
function k(id:string,label:string,area:Area,unit:Unit,formula:string,inputs:string[]):AnalyticsKpi {
  return {id,label,area,unit,formula,requiredInputs:inputs,value:null,status:"unavailable",
    reason:"The required inputs are not established for this scope.",points:[],coo:coo.has(id),plan2027:plan.has(id)};
}
/** Exact original sponsor framework plus the three additional COO measures.
 * These are definitions, never public financial data or invented targets. */
export const framework: AnalyticsKpi[] = [
  k("enterprise_revenue","Total E-Commerce Revenue","financial","usd_cent","Approved, non-overlapping enterprise revenue ledger.",["Approved channel overlap and accounting-grain mapping"]),
  k("yoy_growth","Revenue Growth % (YOY)","financial","percent","100 × (current revenue − prior-year revenue) / prior-year revenue.",["Comparable prior-year publication","Approved revenue definition"]),
  k("gross_margin","Gross Margin %","financial","percent","100 × (revenue − cost of goods sold) / revenue.",["Cost of goods sold","Approved revenue"]),
  k("net_margin","Net Margin %","financial","percent","100 × net operating profit / approved revenue.",["COGS","Labor cost","Overhead","Approved revenue"]),
  k("revenue_labor","Revenue per Labor Hour","financial","usd_cent","Approved revenue / attributed labor hours.",["Labor-hour records","Approved revenue"]),
  k("profit_labor","Profit per Labor Hour","financial","usd_cent","Net operating profit / attributed labor hours.",["Attributed labor hours","Approved profit"]),
  k("items_identified","Items Identified for E-Commerce","production","count","Distinct identification events in the period.",["Identification event timestamps"]),
  k("items_sent","Items Sent to E-Commerce","production","count","Distinct transfer-to-e-commerce events in the period.",["Transfer event timestamps"]),
  k("listings_daily","Listings Created per Day","production","count","Distinct new platform/listing identities by Eastern listing day.",["Published listing events"]),
  k("listings_employee","Listings per Employee","production","count","Listings / scoped employee denominator.",["Listing-to-employee attribution","Employee denominator"]),
  k("time_to_list","Average Time to List an Item","production","days","Mean (listed_at − received_at) for items listed in the period; receipt-to-listing proxy.",["Catalog receipt and listing timestamps"]),
  k("backlog","Unlisted Inventory Backlog","production","count","Unlisted items at one explicitly selected complete inventory snapshot.",["Complete inventory snapshot","Complete catalog"]),
  k("asp","Average Selling Price (ASP)","sales","usd_cent","Net item sales after refunds / reported sold units.",["Item sales and refunds","Positive reported quantity"]),
  k("median_price","Median Sale Price","sales","usd_cent","Median reported per-unit net price; quantity-weighted for multi-unit rows.",["Item sales and refunds","Positive reported quantity"]),
  k("sell_through","Sell-Through Rate","sales","percent","Sold units / approved available-for-sale cohort × 100.",["Approved saleable-inventory cohort and denominator"]),
  k("days_sell","Days to Sell","sales","days","Mean (sold_at − listed_at) for sold catalog items in the period.",["Linked catalog listing and sale timestamps"]),
  k("unsold","Unsold Inventory %","sales","percent","Unsold eligible stock / complete eligible-stock universe × 100.",["Approved stock universe including sold exits"]),
  k("relisted","Relisted Inventory %","sales","percent","Relisted active inventory / complete active inventory × 100.",["Complete active-inventory relisting history"]),
  k("category_sales","Sales by Category","category","usd_cent","Source-local net item sales after refunds, grouped by category.",["Categorized item sales"]),
  k("category_margin","Margin by Category","category","percent","Category profit / approved category revenue × 100.",["Category COGS and attributed operating costs"]),
  k("category_units","Units Sold by Category","category","count","Reported sold quantities grouped by category.",["Categorized sold-unit quantities"]),
  k("category_sell","Sell-Through Rate by Category","category","percent","Category sold units / approved category saleable cohort × 100.",["Category saleable-inventory denominator"]),
  k("category_asp","Average Selling Price by Category","category","usd_cent","Category net item sales / category reported sold quantities.",["Categorized item sales","Reported sold quantities"]),
  k("top_revenue","Top 10 Categories by Revenue","category","usd_cent","Ten highest source-local category net item sales values.",["Categorized item sales"]),
  k("top_margin","Top 10 Categories by Margin","category","percent","Ten highest approved category margin values.",["Category costs and approved margin definition"]),
  k("buyers","Number of Buyers","customer","count","Distinct known buyer_id within one platform and selected period.",["Platform-local buyer identity"]),
  k("repeat_buyers","Repeat Buyer Rate","customer","percent","Known buyers with two or more distinct orders in this period / known buyers × 100; not lifetime loyalty.",["Buyer identity","Distinct order identity"]),
  k("new_buyers","New Buyers","customer","count","Buyers whose first-ever platform purchase falls in the period.",["Complete pre-period buyer purchase history"]),
  k("satisfaction","Customer Satisfaction Rating","customer","rating","Mean approved customer survey response rating.",["Customer survey responses","Rating scale"]),
  k("nps","Net Promoter Score (if available)","customer","rating","Percentage promoters minus percentage detractors.",["0–10 recommendation survey responses"]),
  k("conversion","Marketplace Conversion Metrics","customer","percent","Purchases / approved marketplace visitor or session denominator × 100.",["Marketplace sessions or visits","Approved conversion events"]),
  k("listings_created","Listings Created","production","count","Distinct new platform/listing identities in the period.",["Published listing events"]),
  k("donation_listing","Days from Donation to Listing","inventory","days","Mean listed_at − actual donation timestamp.",["Actual donation timestamps; receipt is not donation"]),
  k("sales_employee","Sales per Employee","production","usd_cent","Approved source sales / attributed employee denominator.",["Sales-to-employee attribution","Employee denominator"]),
];