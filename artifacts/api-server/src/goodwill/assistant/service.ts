import { AskGoodwillAssistantBody, AskGoodwillAssistantResponse, type GoodwillAssistantTool, type GoodwillAssistantProviderUsage } from "@workspace/api-zod";
import { ReportingService, parseQuery, querySchema } from "../data/reporting";
import { DataError, type Query } from "../data/types";
import { ReadOnlyReportingTools } from "./tools";
import { ProviderAttemptError, type AssistantProvider } from "./provider";

type Metric = Awaited<ReturnType<ReportingService["query"]>>["result"];
type Evidence = Awaited<ReturnType<ReportingService["evidence"]>>;
export interface AssistantAnswer {
  status: "answered" | "refused" | "unavailable";
  mode: "deterministic_tools" | "synthetic_openai";
  providerUsage?: GoodwillAssistantProviderUsage;
  answer: string;
  result?: Metric;
  evidence?: Evidence;
  tools: GoodwillAssistantTool[];
  suggestions: string[];
}
const suggestions = ["Explain the selected metric and scope", "Which rows support this figure?", "Show selected source coverage and definition"];
const aliases: Record<string, RegExp> = {
  cash_monkey: /\bcash[ _-]?monkey\b/, upright: /\bupright\b/, jewelry: /\bjewelry\b/,
  shipping: /\b(?:osm|pitney bowes|easypost)\b/, fedex: /\bfedex\b/,
  shopgoodwill: /\bshop[ _-]?goodwill\b/, goodwill_books: /\bgoodwill[ _-]?books\b/,
  ebay: /\be[ _-]?bay\b/, amazon: /\bamazon\b/,
};
const metricMentions: Record<string, RegExp> = {
  net_item_sales: /\bnet[ _-]item[ _-]sales\b/,
  source_net: /\b(?:source[ _-](?:net|named net)|payout)\b/,
  shipping_expense: /\bshipping[ _-]expense\b/,
  daily_customers: /\b(?:daily[ _-]customers|distinct buyers)\b/,
  listings: /\b(?:new[ _-]listings|listings)\b/,
  backlog: /\bbacklog\b/,
};
function refusal(question: string, q: Query): string | null {
  // Normalize compatibility forms and invisible separators before policy checks.
  const text = question.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").toLowerCase();
  if (/\b(?:ignore|override|bypass|disregard|forget)\b.*\b(?:instructions?|rules?|polic(?:y|ies)|previous|prior|auth|restrictions?|filters?|context)\b|\b(?:system prompt|developer message|jailbreak|act as|pretend to|you are now)\b|<\s*\/?\s*(?:system|developer|script)\b|<\|(?:system|developer)\|>|\b(?:system|developer)\s*:/.test(text))
    return "Instruction overrides and authorization bypasses are refused. Dashboard context and existing approved-operator authorization remain mandatory.";
  if (/\b(?:credentials?|passwords?|secrets?|tokens?|api[ _-]?keys?|signed[ _-]?urls?|private[ _-]?(?:paths?|objects?|storage)|connection[ _-]?strings?|operator[ _-]?emails?|environment variables?|env vars?|database url|bearer|session cookies?)\b/.test(text))
    return "Credentials, private storage capabilities and operator identity data are not available through reporting tools.";
  if (/\b(?:insert|update|delete|drop|truncate|alter|grant|revoke|execute|exec|write|publish|supersede|approve|upload|import|cancel|mutate|modify|change|edit|remove|replace|create)\b|\b(?:sql|shell|bash|curl)\b/.test(text))
    return "This assistant is read-only. It cannot change data, run SQL or commands, publish batches or perform acquisition.";
  if (/\b(?:margin|profit|profitability|labor|productivity|sell[ -]?through|roi|forecast|gross[ _-](?:sales|revenue)|average order value|aov|conversion|customer lifetime|order count|return rate|refund rate)\b/.test(text))
    return "That metric is unsupported by the approved definitions and source grains. Margin, labor productivity and sell-through cannot be inferred from these inputs.";
  if (/\b(?:all|across|combined|combine|sum|total|aggregate)\b.{0,45}\b(?:sources|platforms|company|business|marketplaces)\b|\b(?:company[ -]?wide|cross[ -]?source|grand total|total revenue)\b/.test(text))
    return "Cross-source totals are refused: overlapping sales, expenses and statements have incompatible grains. Select one business source.";
  for (const [id, pattern] of Object.entries(aliases))
    if (id !== q.sourceId && pattern.test(text))
      return "The question names a different source. Change the dashboard source first, then ask again; the selected context is never silently overridden.";
  for (const [id, pattern] of Object.entries(metricMentions))
    if (id !== q.metricId && pattern.test(text))
      return "The question names a different metric. Select that metric in the dashboard first; this request remains bound to the supplied context.";
  const dates: string[] = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  const stores: string[] = text.match(/\bgw-\d{3}\b/g) ?? [];
  if (dates.some(date => date !== q.period.startDate && date !== q.period.endDate && date !== q.snapshotAt?.slice(0, 10)) ||
      stores.some(store => store.toUpperCase() !== q.storeId))
    return "The question requests filters outside the selected context. Change the dashboard dates/store first and ask again.";
  return null;
}
function scope(q: Query) {
  return `${q.sourceId}; ${q.metricId}; ${q.period.startDate} through ${q.period.endDate}; store ${q.storeId ?? "all (including unresolved)"}; grouping ${q.groupBy}${q.snapshotAt ? `; snapshot ${q.snapshotAt}` : ""}`;
}
function explain(result: Metric) {
  const def = result.definition;
  const value = result.value === null
    ? result.points.length && !def.availabilityReason ? "No additive period aggregate; use the returned daily points." : "Unavailable; no zero or estimate is inferred."
    : `${result.value} ${def.unit}${def.unit === "usd_cent" ? " (integer USD cents, not dollars)" : ""}.`;
  return `Selected scope: ${scope(result.query)}. ${def.label}: ${value} Formula: ${def.formula}. Grain: ${def.grain}. Time basis: ${def.timeBasis}. Definition version: ${def.version}. Publication: ${result.publicationId ?? "none"}. Coverage: ${result.coverage.map(c => `${c.datasetId}=${c.status}`).join(", ")}.${result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : ""}`;
}

/** No conversation cache or model/client answer/publication override:
 * every call evaluates its fresh validated context. Model routing is opt-in;
 * no tool results or arbitrary free text ever go back to the provider. */
export class GoodwillAssistantService {
  constructor(private reporting: ReportingService, private provider?: AssistantProvider) {}
  async ask(input: unknown): Promise<AssistantAnswer> {
    const parsed = AskGoodwillAssistantBody.strict().extend({ context: querySchema }).safeParse(input);
    if (!parsed.success || !parsed.data.question.trim())
      throw new DataError("INVALID_ASSISTANT_QUERY", "Provide a nonempty question (at most 2000 characters) and one valid metric context.");
    const q = parseQuery(parsed.data.context);
    const mode = parsed.data.mode ?? "deterministic_tools";
    let providerUsage: GoodwillAssistantProviderUsage | undefined;
    const respond = (answer: Omit<AssistantAnswer, "mode" | "suggestions">): AssistantAnswer => {
      const wire: AssistantAnswer = { ...answer, mode, suggestions, ...(providerUsage ? { providerUsage } : {}) };
      // Validate without returning coerced Date objects; wire dates stay ISO strings.
      AskGoodwillAssistantResponse.parse(wire);
      return wire;
    };
    const denied = refusal(parsed.data.question, q);
    if (denied) return respond({ status: "refused", answer: denied, tools: [] });
    const text = parsed.data.question.toLowerCase();
    let evidenceIntent = /\b(?:evidence|rows?|records?|support(?:ing)?|trace|provenance|lineage|contributing|prove|proof|figure)\b/.test(text);
    let catalogIntent = /\b(?:coverage|catalog|datasets?|sources?|definitions?|formula|available|missing|stale|complete)\b/.test(text);
    const metricIntent = /\b(?:explain|metric|sales|net|payout|expense|customers?|buyers?|listings?|backlog|value|amount|how much|how many|why|selected|this)\b/.test(text);
    if (!evidenceIntent && !catalogIntent && !metricIntent)
      return respond({ status: "refused", answer: "Only selected-metric explanations, supporting evidence and source coverage/definitions are supported. This is deterministic tool routing, not a general-purpose model.", tools: [] });
    if (mode === "synthetic_openai") {
      try {
        if (!this.provider) throw new DataError("MODEL_NOT_CONNECTED", "Managed OpenAI access is not connected. No provider call was made; model-free mode remains available.", 503);
        const plan = await this.provider.route(parsed.data.question);
        providerUsage = plan.usage;
        // Fail closed if a model omits tools necessary to ground this question.
        // A mention of the selected "source" alone is not a coverage request.
        const catalogRequired = /\b(?:coverage|catalog|datasets?|definitions?|formula|available|missing|stale|complete)\b/.test(text);
        if (!plan.tools.includes("query_metric") || evidenceIntent && !plan.tools.includes("read_evidence") ||
            catalogRequired && !plan.tools.includes("read_catalog"))
          return respond({ status: "unavailable", answer: "The model omitted a required grounding tool. No answer is inferred; the attempt's reservation is retained.", tools: [] });
        evidenceIntent = plan.tools.includes("read_evidence");
        catalogIntent = plan.tools.includes("read_catalog");
      } catch (error) {
        if (error instanceof ProviderAttemptError) providerUsage = error.usage;
        return respond({
          status: error instanceof DataError && error.code === "SYNTHETIC_PROMPT_REQUIRED" ? "refused" : "unavailable",
          answer: error instanceof DataError ? error.message : "The model routing service is unavailable. No answer is invented and no silent model-free fallback is used.",
          tools: [],
        });
      }
    }
    const tools: GoodwillAssistantTool[] = [];
    const executor = new ReadOnlyReportingTools(this.reporting);
    let result: Metric | undefined;
    let activeTool = "query_metric";
    try {
      result = await executor.queryMetric(q);
      const unavailable = !!result.definition.availabilityReason;
      tools.push({ name: activeTool, status: unavailable ? "unavailable" : "completed" });
      let answer = explain(result);
      if (catalogIntent) {
        activeTool = "read_catalog";
        const catalog = await executor.readCatalog();
        tools.push({ name: activeTool, status: "completed" });
        const sourceDatasets = catalog.datasets.filter(d => d.sourceId === q.sourceId);
        answer += ` Source datasets: ${sourceDatasets.map(d => `${d.id} (${d.role}; ${d.coverage.status}; ${d.coverage.reason})`).join("; ")}. Required inputs: ${result.definition.requiredDatasets.join(", ")}. Supporting dimensions/operational datasets remain separate from nine business sources.`;
      }
      let evidence: Evidence | undefined;
      if (evidenceIntent && result.publicationId && !unavailable) {
        activeTool = "read_evidence";
        evidence = await executor.readEvidence({ query: q, publicationId: result.publicationId, offset: 0, limit: 100 });
        tools.push({ name: activeTool, status: "completed" });
        answer += ` Evidence: ${evidence.total} contributing accepted rows at publication ${evidence.publicationId}; returned ${evidence.items.length} rows (offset 0, limit 100). Use the evidence endpoint with this exact query/publication for further pages. A proven zero may have no contributing rows; completeness inputs remain in result.batchIds.`;
      }
      return respond({ status: unavailable ? "unavailable" : "answered", answer, result, ...(evidence ? { evidence } : {}), tools });
    } catch {
      tools.push({ name: activeTool, status: "failed" });
      return respond({ status: "unavailable", answer: "The read-only reporting/evidence service is unavailable. No answer, zero, or evidence is invented. Retry with the same context after service access is restored.", ...(result ? { result } : {}), tools });
    }
  }
}