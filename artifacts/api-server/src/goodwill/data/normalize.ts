import { createHash } from "node:crypto";
import { DataError, type Dataset, type LedgerRecord, type Values } from "./types";
export const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
export const MAX_BYTES = 5242880;
const fail = (code: string, message: string): never => { throw new DataError(code, message); };
export function money(value: string, signed = false) {
  if (!(signed ? /^-?\d+\.\d{2}$/ : /^\d+\.\d{2}$/).test(value)) return fail("INVALID_MONEY", "Amount requires exact decimal cents with the approved sign.");
  const negative = value.startsWith("-");
  const [whole, part] = value.replace("-", "").split(".");
  const cents = BigInt(whole) * 100n + BigInt(part);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return fail("UNSAFE_MONEY", "Amount exceeds safe integer cents.");
  return Number(negative ? -cents : cents);
}
export function sum(values: number[]) {
  const total = values.reduce((a,b) => a + BigInt(b), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) return fail("UNSAFE_TOTAL", "Total exceeds safe integer cents.");
  return Number(total);
}
export function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)
    return fail("INVALID_DATE", "Invalid calendar date.");
  return value;
}
export function instant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
    return fail("INVALID_DATE", "Timestamp requires an explicit timezone.");
  date(value.slice(0,10)); return new Date(value).toISOString();
}
const eastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export function day(value: string) { return value.includes("T") ? eastern.format(new Date(instant(value))) : date(value); }
export function period(p: { startDate: string; endDate: string }) {
  date(p.startDate); date(p.endDate);
  if (p.startDate > p.endDate || Date.parse(p.endDate)-Date.parse(p.startDate)>366*86400000)
    fail("INVALID_PERIOD", "Use chronological bounds within a maximum 366-day supervised query/intake window.");
  return p;
}
export function parseCsv(bytes: Uint8Array, header: string[]) {
  if (!bytes.length || bytes.length > MAX_BYTES) return fail("INVALID_FILE_SIZE", "CSV must contain 1..5 MiB of original bytes.");
  let csv: string;
  try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail("INVALID_ENCODING", "CSV must be valid UTF-8."); }
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const pushCell = () => { row.push(cell); cell = ""; closed = false; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) { if (c === '"') { if (csv[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") { if (c === "\r" && csv[i+1] === "\n") i++; pushRow(); }
    else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === '"' || closed) return fail("MALFORMED_CSV", "Invalid quoting.");
    else cell += c;
  }
  if (quoted) return fail("MALFORMED_CSV", "Unclosed quoted field.");
  if (cell || row.length || closed) pushRow();
  if (!rows.length || JSON.stringify(rows[0]) !== JSON.stringify(header)) return fail("INVALID_HEADER", "Header must match the explicitly selected source/report.");
  if (rows.length === 1) return fail("EMPTY_REPORT", "A header alone cannot establish coverage or publish zero.");
  if (rows.length > 20001) return fail("TOO_MANY_ROWS", "Synthetic intake supports at most 20,000 records per file.");
  return rows.slice(1);
}
export function normalize(d: Dataset, fields: string[], p: {startDate: string; endDate: string}): Omit<LedgerRecord, "id"|"batchId"|"runId"|"artifactId"|"checksum"|"sourceRow"> {
  if (fields.length !== d.header.length) return fail("INVALID_ROW_WIDTH", "Record has a different number of fields.");
  const raw = Object.fromEntries(d.header.map((f,i) => [f,fields[i]]));
  const v: Values = { ...raw }, warnings: string[] = [];
  for (const key of d.keyFields) if (!raw[key]) return fail("MISSING_KEY", "Required source identity is empty.");
  if (raw.quantity !== undefined) {
    if (!/^[1-9]\d{0,5}$/.test(raw.quantity)) return fail("INVALID_QUANTITY", "Quantity must be a positive bounded integer.");
    v.quantity = Number(raw.quantity); // Amounts are already line totals.
  }
  for (const field of ["synthetic","supplier_confirmed","relisted"])
    if (raw[field] !== undefined) {
      if (!["true","false"].includes(raw[field]) || field === "synthetic" && raw[field] !== "true")
        return fail("INVALID_SYNTHETIC_FLAG", "Invalid synthetic/boolean flag.");
      v[field] = raw[field] === "true";
    }
  if (raw.currency !== undefined && raw.currency !== "USD") return fail("UNSUPPORTED_CURRENCY", "Only synthetic USD is supported.");
  if (["exception","lifecycle"].includes(d.role)) {
    if (!/^[1-9]\d*$/.test(raw.source_row_id) || !Number.isSafeInteger(Number(raw.source_row_id)))
      return fail("INVALID_SOURCE_ORDINAL","Sidecar source ordinals must be positive safe integers.");
    v.source_row_id = Number(raw.source_row_id);
  }
  let activity = d.date ? day(raw[d.date]) : null, month: string | null = null;
  for (const field of ["paid_at","listed_at","received_at","sold_at","canceled_at","snapshot_at","ordered_at","refund_recorded_at"])
    if (raw[field]) v[field] = instant(raw[field]);
  for (const field of ["payment_date","ship_date"]) if (raw[field]) v[field] = date(raw[field]);
  if (d.role === "statement") {
    if (!/^\d{4}-\d{2}$/.test(raw.statement_month)) return fail("INVALID_DATE", "Statement month is invalid.");
    month = date(raw.statement_month + "-01").slice(0,7);
    if (p.startDate !== month + "-01" || p.endDate !== new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).toISOString().slice(0,10))
      return fail("STATEMENT_PERIOD_REQUIRED", "Books require the complete declared statement month, not payment-day allocation.");
    activity = null;
  }
  if (["sales","expense"].includes(d.role) && activity && (activity < p.startDate || activity > p.endDate))
    return fail("WRONG_PERIOD", "Source activity lies outside the declared reporting period.");
  for (const f of d.monetaryFields) v[f] = money(raw[f], ["adjustment_amount","net_proceeds","payout_amount","net_payout","net_sales","net_amount"].includes(f));
  const gross = d.gross ? v[d.gross] as number : null, refunds = d.refund ? v[d.refund] as number : 0;
  if (gross !== null && refunds > gross) return fail("INVALID_REFUND", "Item refunds exceed gross item sales.");
  if (d.net && d.plus) {
    const computed = sum([...d.plus.map(f => v[f] as number), ...d.minus!.map(f => -(v[f] as number))]);
    if (v[d.net] !== computed) return fail("SOURCE_FORMULA_MISMATCH", "Source-named net does not reconcile to its approved formula.");
  }
  if (d.id === "upright" && raw.channel !== "Upright") return fail("INVALID_CHANNEL", "Wrong source channel.");
  if (raw.platform && !["ShopGoodwill","eBay"].includes(raw.platform)) return fail("INVALID_PLATFORM", "Only the declared two-platform operational universe is supported.");
  if (d.id === "inventory" && !["received","awaiting_inspection","awaiting_photography","ready_to_list","listed"].includes(raw.workflow_state))
    return fail("INVALID_WORKFLOW_STATE", "Unknown inventory state.");
  if (d.id === "lifecycle" && !["shipped","pending_fulfillment","canceled_before_fulfillment","local_pickup"].includes(raw.fulfillment_status))
    return fail("INVALID_FULFILLMENT", "Unknown lifecycle state.");
  if (d.id === "jewelry" && (!raw.supplier || v.supplier_confirmed !== true)) warnings.push("UNCONFIRMED_SUPPLIER");
  if (d.buyer && !raw[d.buyer]) warnings.push("MISSING_BUYER");
  if ("store_id" in raw && !raw.store_id) warnings.push("UNKNOWN_STORE");
  const key = JSON.stringify(d.keyFields.map(k => v[k]));
  const fingerprint = hash(JSON.stringify(v));
  return { datasetId: d.id, key, fingerprint, role: d.role, sourceId: d.sourceId, values: v,
    date: activity, month, storeId: raw.store_id || null, buyerId: d.buyer ? raw[d.buyer] || null : null,
    platform: raw.platform === "ShopGoodwill" ? "shopgoodwill" : raw.platform === "eBay" ? "ebay" : ["shopgoodwill","ebay"].includes(d.sourceId) ? d.sourceId : null,
    category: raw.category || null, netItemMinor: d.id === "jewelry" || gross === null ? null : sum([gross,-refunds]),
    sourceNetMinor: d.net ? v[d.net] as number : null,
    expenseMinor: d.id === "shipping" ? sum([v.postage_amount as number,v.adjustment_amount as number]) : d.id === "fedex" ? v.net_amount as number : null,
    warnings };
}