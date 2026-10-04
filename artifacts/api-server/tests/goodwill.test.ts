import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GenerateGoodwillReportResponse, ImportGoodwillReportResponse, GetGoodwillLatestResponse } from "@workspace/api-zod";
import { calculateReport, generateReport, checksum, parseCsv, minorUnits, reportingDate, ReportError } from "../src/lib/goodwill";

const fixture = readFileSync("../../docs/goodwill/evidence/github/goodwill/synthetic-data/02_upright_paid_order_items_aug2026.csv", "utf8");
const full = { startDate: "2026-08-01", endDate: "2026-08-31" };
const report = generateReport(full, fixture);
const expectCode = (code: string, fn: () => unknown) =>
  assert.throws(fn, (err: unknown) => err instanceof ReportError && err.code === code);

test("runtime report/result envelopes validate against generated OpenAPI schemas", () => {
  GenerateGoodwillReportResponse.parse(report);
  const result = { ...calculateReport(report), importId: "foundation-contract-test", publishedAt: "2026-10-04T00:00:00Z" };
  ImportGoodwillReportResponse.parse(result);
  GetGoodwillLatestResponse.parse({ result });
  GetGoodwillLatestResponse.parse({ result: null });
});
test("merged fixture matches independently computed USD-cent controls", () => {
  const r = calculateReport(report);
  assert.equal(r.acceptedRows, 650);
  assert.equal(r.grossMinor, 3702126);
  assert.equal(r.refundMinor, 86416);
  assert.equal(r.netMinor, 3615710);
  assert.equal(r.rows.filter(x => !x.buyerId).length, 8);
  assert.match(r.warnings.join(" "), /8 source rows lack buyer/);
  assert.equal(r.coverage, "single_source_synthetic");
});
test("alternate dates change report bytes and independently checked totals", () => {
  const first = generateReport({ startDate: "2026-08-01", endDate: "2026-08-07" }, fixture);
  const second = generateReport({ startDate: "2026-08-08", endDate: "2026-08-14" }, fixture);
  assert.notEqual(first.checksum, second.checksum);
  assert.equal(calculateReport(first).netMinor, 759121);
  assert.equal(calculateReport(first).acceptedRows, 141);
  assert.equal(calculateReport(second).netMinor, 597274);
  assert.equal(calculateReport(second).acceptedRows, 129);
});
test("download SHA-256 describes exact UTF-8 content", () => assert.equal(checksum(report.csv), report.checksum));
test("unmatched bytes, empty report, malformed quotes and changed header reject", () => {
  expectCode("CHECKSUM_MISMATCH", () => calculateReport({ ...report, csv: report.csv + "\n" }));
  const empty = report.csv.split("\n")[0] + "\n";
  expectCode("EMPTY_REPORT", () => calculateReport({ ...report, csv: empty, checksum: checksum(empty) }));
  expectCode("INVALID_HEADER", () => parseCsv("wrong,header\n1,2\n"));
  expectCode("MALFORMED_CSV", () => parseCsv('"never closed'));
});
test("duplicate order-item identity rejects before publication", () => {
  const lines = report.csv.trimEnd().split("\n");
  const csv = lines.concat(lines[1]).join("\n") + "\n";
  expectCode("DUPLICATE_ROW", () => calculateReport({ ...report, csv, checksum: checksum(csv) }));
});
test("invalid, unsupported and wrong periods reject", () => {
  expectCode("INVALID_PERIOD", () => generateReport({ startDate: "2026-08-31", endDate: "2026-08-01" }, fixture));
  expectCode("INVALID_PERIOD", () => generateReport({ startDate: "2026-08-32", endDate: "2026-08-32" }, fixture));
  expectCode("UNSUPPORTED_PERIOD", () => generateReport({ startDate: "2026-09-01", endDate: "2026-09-30" }, fixture));
  expectCode("WRONG_PERIOD", () => calculateReport({ ...report, startDate: "2026-08-02" }));
});
test("money is exact integer cents and excludes source net-sales field", () => {
  assert.equal(minorUnits("0.29") + minorUnits("0.01"), 30);
  expectCode("INVALID_AMOUNT", () => minorUnits("12.345"));
  expectCode("INVALID_AMOUNT", () => minorUnits("-1.00"));
  expectCode("INVALID_AMOUNT", () => minorUnits("1e2"));
  expectCode("INVALID_AMOUNT", () => minorUnits(""));
  const r = calculateReport(report);
  assert.equal(r.netMinor, r.grossMinor - r.refundMinor);
  assert.equal(r.rows.reduce((sum, row) => sum + row.netMinor, 0), r.netMinor);
});
test("explicit timezone converts to Eastern reporting day", () => {
  assert.equal(reportingDate("2026-08-02T02:00:00Z"), "2026-08-01");
  expectCode("INVALID_TIMESTAMP", () => reportingDate("2026-08-02T02:00:00"));
  expectCode("INVALID_TIMESTAMP", () => reportingDate("2026-02-30T02:00:00Z"));
});
test("CSV preserves quoted commas, quotes, line breaks and CRLF", () => {
  const header = report.csv.split("\n")[0];
  const row = `id,2026-08-01T00:00:00-04:00,item,store,Upright,buyer,"A ""quote"",\nsecond line",cat,1.00,0.00,0.00,0.00,0.00,1.00`;
  const csv = header + "\r\n" + row + "\r\n";
  const parsed = parseCsv(csv);
  assert.equal(parsed[1][6], 'A "quote",\nsecond line');
  assert.equal(calculateReport({ ...report, csv, checksum: checksum(csv) }).netMinor, 100);
});