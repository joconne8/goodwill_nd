import { createHash } from "node:crypto";
import { generateReport, parseCsv, reportingDate } from "../../lib/goodwill";
import { AcquisitionError, type DownloadEvidence, type Request } from "./contracts";

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const MAX_BYTES = 5 * 1024 * 1024;
export function isTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value.slice(0, 10)).toISOString().slice(0, 10) === value.slice(0, 10);
}
/** File/coverage verifier only; never calculates or publishes financial metrics. */
export function verifyDownload(request: Request, evidence: DownloadEvidence, fixture: string) {
  const { bytes, manifest: m } = evidence;
  const bad = (code: string, message: string): never => { throw new AcquisitionError(code, message); };
  if (!isTimestamp(evidence.downloadedAt)) bad("INVALID_DOWNLOAD_TIME", "Browser download time must be a valid timestamp.");
  if (!m || typeof m !== "object") bad("INVALID_MANIFEST", "Downloaded report metadata is missing.");
  if (!bytes.length || bytes.length > MAX_BYTES) bad("INVALID_FILE_SIZE", "Download must be nonempty and no larger than 5 MiB.");
  if (m.sourceId !== request.sourceId || m.reportType !== request.reportType ||
      m.synthetic !== true || m.timezone !== "America/New_York" || m.contractVersion !== "1.0.0")
    bad("INVALID_REPORT_IDENTITY", "Downloaded report is not the approved Eastern synthetic item report.");
  if (m.startDate !== request.period.startDate || m.endDate !== request.period.endDate)
    bad("WRONG_REPORT_DATES", "Report metadata does not match the requested inclusive dates.");
  const expected = generateReport(request.period, fixture);
  if (evidence.suggestedFilename !== expected.filename || m.filename !== expected.filename)
    bad("INVALID_FILENAME", "Downloaded attachment does not have the expected report filename.");
  if (m.byteSize !== bytes.length || sha256(bytes) !== m.checksum)
    bad("CHECKSUM_MISMATCH", "Downloaded bytes do not match their frozen size and checksum.");
  let csv: string;
  try { csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return bad("INVALID_ENCODING", "Only valid UTF-8 CSV is supported."); }
  const records = parseCsv(csv).slice(1);
  if (!records.length) bad("EMPTY_REPORT", "A header-only download is not acquired coverage.");
  for (const row of records) {
    const date = reportingDate(row[1]);
    if (date < request.period.startDate || date > request.period.endDate)
      bad("WRONG_REPORT_DATES", "Downloaded item dates lie outside the requested Eastern period.");
  }
  if (csv !== expected.csv || m.checksum !== expected.checksum)
    bad("UNEXPECTED_REPORT_BYTES", "Download differs from the unchanged approved synthetic report for this period.");
  return Object.freeze({ ...m });
}