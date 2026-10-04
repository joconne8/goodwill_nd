import { createHash } from "node:crypto";
import { ImportGoodwillReportBody, GenerateGoodwillReportBody } from "@workspace/api-zod";

export type SyntheticReport = ReturnType<typeof ImportGoodwillReportBody.parse>;
export const DEFINITION_VERSION = "demo-net-item-sales/1.0.0";
export const HEADER = ["paid_order_id", "paid_at", "item_id", "store_id", "channel", "buyer_id", "item_title", "category", "gross_sales", "shipping_collected", "sales_tax", "marketplace_fee", "refund_amount", "net_sales"];

export class ReportError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export const checksum = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const fail = (code: string, message: string): never => { throw new ReportError(code, message); };

/** Strict CSV reader: quoted commas/newlines, doubled quotes, LF and CRLF. */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  const pushCell = () => { row.push(cell); cell = ""; closed = false; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += c;
    } else if (c === ",") pushCell();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      pushRow();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === '"' || closed) fail("MALFORMED_CSV", "Unexpected text or quote after a CSV field.");
    else cell += c;
  }
  if (quoted) fail("MALFORMED_CSV", "Unclosed quoted CSV field.");
  if (cell !== "" || row.length || closed) pushRow();
  if (!rows.length || rows[0].join(",") !== HEADER.join(",")) fail("INVALID_HEADER", "Expected the synthetic Upright paid-order-item header.");
  if (rows.slice(1).some(r => r.length !== HEADER.length)) fail("MALFORMED_CSV", "Every row must have exactly 14 fields.");
  return rows;
}

function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
}
export function validatePeriod(input: unknown) {
  const parsed = GenerateGoodwillReportBody.safeParse(input);
  if (!parsed.success) return fail("INVALID_PERIOD", "Use startDate and endDate in YYYY-MM-DD format.");
  const p = parsed.data;
  if (!validDate(p.startDate) || !validDate(p.endDate) || p.startDate > p.endDate)
    return fail("INVALID_PERIOD", "Provide valid dates in chronological order.");
  if (p.startDate < "2026-08-01" || p.endDate > "2026-08-31")
    return fail("UNSUPPORTED_PERIOD", "This synthetic fixture covers August 2026 only.");
  return p;
}
export function minorUnits(value: string): number {
  if (!/^\d{1,9}\.\d{2}$/.test(value)) return fail("INVALID_AMOUNT", "Financial values must be nonnegative decimal line totals with exactly two places.");
  const [whole, cents] = value.split(".");
  return Number(whole) * 100 + Number(cents);
}
const easternDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export function reportingDate(timestamp: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ||
    !validDate(timestamp.slice(0, 10)) || Number.isNaN(Date.parse(timestamp)))
    return fail("INVALID_TIMESTAMP", "paid_at must be an ISO timestamp with an explicit timezone.");
  const parts = easternDate.formatToParts(new Date(timestamp));
  const part = (kind: string) => parts.find(p => p.type === kind)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const encodeCell = (s: string) => /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;

export function generateReport(input: unknown, fixture: string): SyntheticReport {
  const period = validatePeriod(input);
  const parsed = parseCsv(fixture);
  const selected = parsed.slice(1).filter(row => {
    const date = reportingDate(row[1]);
    return date >= period.startDate && date <= period.endDate;
  });
  const csv = [parsed[0], ...selected].map(r => r.map(encodeCell).join(",")).join("\n") + "\n";
  return {
    ...period, sourceId: "upright", reportType: "paid_order_items",
    filename: `synthetic_upright_${period.startDate}_${period.endDate}.csv`,
    csv, checksum: checksum(csv), synthetic: true, contractVersion: "1.0.0",
  };
}

/** Pure validation/normalization. No write can occur before this succeeds. */
export function calculateReport(input: unknown) {
  const parsed = ImportGoodwillReportBody.safeParse(input);
  if (!parsed.success) return fail("INVALID_REPORT", "The report metadata does not match contract 1.0.0.");
  const report = parsed.data;
  const period = validatePeriod(report);
  if (checksum(report.csv) !== report.checksum) return fail("CHECKSUM_MISMATCH", "The selected file differs from the downloaded report.");
  const records = parseCsv(report.csv).slice(1);
  if (!records.length) return fail("EMPTY_REPORT", "A header-only report cannot publish a zero total.");
  const keys = new Set<string>();
  const rows = records.map((r, index) => {
    const sourceRow = index + 1;
    if (!r[0] || !r[2] || r[4] !== "Upright") return fail("INVALID_IDENTITY", `Source row ${sourceRow} is missing an order/item identity or uses another channel.`);
    const key = `${r[0]}\0${r[2]}`;
    if (keys.has(key)) return fail("DUPLICATE_ROW", `Source row ${sourceRow} repeats an order/item key.`);
    keys.add(key);
    const soldDate = reportingDate(r[1]);
    if (soldDate < period.startDate || soldDate > period.endDate)
      return fail("WRONG_PERIOD", `Source row ${sourceRow} lies outside the declared reporting period.`);
    // All monetary columns are validated, but source payout/net_sales is not our metric.
    [8, 9, 10, 11, 12, 13].forEach(i => minorUnits(r[i]));
    const grossMinor = minorUnits(r[8]), refundMinor = minorUnits(r[12]);
    if (refundMinor > grossMinor) return fail("INVALID_REFUND", `Source row ${sourceRow} refunds exceed item sales.`);
    return { sourceRow, orderId: r[0], itemId: r[2], soldDate, storeId: r[3] || null,
      buyerId: r[5] || null, grossMinor, refundMinor, netMinor: grossMinor - refundMinor };
  });
  const sum = (key: "grossMinor" | "refundMinor" | "netMinor") => rows.reduce((total, row) => total + row[key], 0);
  const missingBuyer = rows.filter(r => !r.buyerId).length;
  const missingStore = rows.filter(r => !r.storeId).length;
  return {
    sourceId: report.sourceId, reportType: report.reportType, filename: report.filename,
    checksum: report.checksum, ...period, timezone: "America/New_York" as const,
    currency: "USD" as const, synthetic: true, contractVersion: "1.0.0",
    definitionVersion: DEFINITION_VERSION, grossMinor: sum("grossMinor"),
    refundMinor: sum("refundMinor"), netMinor: sum("netMinor"), acceptedRows: rows.length,
    coverage: "single_source_synthetic" as const,
    warnings: [
      "Synthetic single-source fixture, not total Goodwill revenue. Eight other source workflows are not connected.",
      "Customer totals, labor productivity, margin and sell-through are unavailable in this foundation.",
      ...(missingBuyer ? [`${missingBuyer} source rows lack buyer IDs; do not estimate missing customers.`] : []),
      ...(missingStore ? [`${missingStore} source rows lack store attribution.`] : []),
      "Raw-file archiving, acquisition run tracking and correction approval are deferred to the downstream lanes.",
    ], rows,
  };
}