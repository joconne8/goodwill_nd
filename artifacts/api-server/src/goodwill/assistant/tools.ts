import { QueryGoodwillEvidenceBody } from "@workspace/api-zod";
import { ReportingService, parseQuery, querySchema } from "../data/reporting";
import { DataError } from "../data/types";

/** Approved model adapters can consume these descriptors; no SQL, write, storage
 * capability or provider execution is exposed. HTTP callers use the existing
 * authorized catalog/metrics/evidence endpoints or the assistant router. */
export const readOnlyToolDefinitions = [
  {
    name: "query_metric", readOnly: true,
    description: "Evaluate exactly one validated source-local metric in the supplied dashboard context. Returns an immutable publication reference.",
    inputSchema: { $ref: "#/components/schemas/MetricQuery" },
    endpoint: { method: "POST", path: "/api/goodwill/v2/metrics/query" },
  },
  {
    name: "read_evidence", readOnly: true,
    description: "Retrieve bounded contributing rows for the exact query and immutable publication returned by query_metric.",
    inputSchema: { $ref: "#/components/schemas/EvidenceQuery" },
    endpoint: { method: "POST", path: "/api/goodwill/v2/evidence/query" },
  },
  {
    name: "read_catalog", readOnly: true,
    description: "Read metric definitions, source dataset roles and actual coverage. Supporting datasets are not business sources.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    endpoint: { method: "GET", path: "/api/goodwill/v2/catalog" },
  },
] as const;

/** Per-request tool executor. It intentionally has no access to SQL or intake. */
export class ReadOnlyReportingTools {
  constructor(private reporting: ReportingService) {}
  async queryMetric(context: unknown) {
    return (await this.reporting.query(parseQuery(context))).result;
  }
  async readEvidence(input: unknown) {
    const parsed = QueryGoodwillEvidenceBody.strict().extend({ query: querySchema }).safeParse(input);
    if (!parsed.success || !parsed.data.publicationId.trim())
      throw new DataError("INVALID_EVIDENCE_QUERY", "Evidence requires a validated scope, immutable publication and bounded pagination.");
    return this.reporting.evidence({ ...parsed.data, query: parseQuery(parsed.data.query) });
  }
  async readCatalog() { return this.reporting.catalog(); }
  async call(name: string, input: unknown) {
    switch (name) {
      case "query_metric": return this.queryMetric(input);
      case "read_evidence": return this.readEvidence(input);
      case "read_catalog":
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length)
          throw new DataError("INVALID_TOOL_INPUT", "Catalog input must be an empty object.");
        return this.readCatalog();
      default: throw new DataError("UNSUPPORTED_TOOL", "Only the named read-only reporting tools are available.");
    }
  }
}