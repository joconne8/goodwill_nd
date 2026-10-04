import type { GoodwillAssistantProviderUsage } from "@workspace/api-zod";
import { DataError } from "../data/types";
import type { UsageLedger } from "./usage";

// These are synthetic test prompts, not arbitrary operator/customer text.
// Only these exact prompts may cross the provider boundary. No dashboard data,
// identifiers, filters, evidence, publication, tool results or history is sent.
export const syntheticQuestions = [
  "Explain this metric for this source and period",
  "Explain the selected metric and scope",
  "Which rows support this figure?",
  "Show selected source coverage and definition",
] as const;
export type RoutingTool = "query_metric" | "read_evidence" | "read_catalog";
export interface ModelRoute {
  tools: RoutingTool[];
  usage: GoodwillAssistantProviderUsage;
}
export interface AssistantProvider { route(question: string): Promise<ModelRoute> }
export class ProviderAttemptError extends DataError {
  constructor(public usage: GoodwillAssistantProviderUsage) {
    super("MODEL_ATTEMPT_FAILED", "The model attempt failed or returned an invalid read-only plan. Its spending reservation is retained; no provider text or financial answer is used.", 503);
  }
}

const toolNames: RoutingTool[] = ["query_metric", "read_evidence", "read_catalog"];
const parameters = { type: "object", properties: {}, required: [], additionalProperties: false };
const descriptions = [
  "Read the selected source-local metric and its exact scope/definition. Required for every answer.",
  "Read contributing rows pinned to the metric's immutable publication. Select for row/support/evidence questions.",
  "Read selected source coverage and dataset definitions. Select for coverage/definition questions.",
];
export const providerTools = toolNames.map((name, i) => ({
  type: "function", function: { name, description: descriptions[i], strict: true, parameters },
}));

/** Reject rather than interpreting prose, fabricated figures, arguments or
 * unknown tools. The server owns all tool arguments and execution order. */
export function parseProviderPlan(raw: unknown): { tools: RoutingTool[]; inputTokens: number; outputTokens: number } {
  const r = raw as { model?: unknown; choices?: Array<{ finish_reason?: unknown; message?: {
    content?: unknown; tool_calls?: Array<{ type?: unknown; function?: { name?: unknown; arguments?: unknown } }> } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } };
  if (!r || r.model !== "gpt-5-mini" && r.model !== "gpt-5-mini-2025-08-07" ||
      !Array.isArray(r.choices) || r.choices.length !== 1 || r.choices[0].finish_reason !== "tool_calls")
    throw new Error("Invalid provider envelope");
  const message = r.choices[0].message;
  if (!message || message.content != null && message.content !== "" ||
      !Array.isArray(message.tool_calls) || message.tool_calls.length < 1 || message.tool_calls.length > 3)
    throw new Error("Only bounded tool calls are accepted");
  const tools: RoutingTool[] = message.tool_calls.map(call => {
    if (call.type !== "function" || !toolNames.includes(call.function?.name as RoutingTool) ||
        typeof call.function?.arguments !== "string") throw new Error("Invalid tool");
    const args = JSON.parse(call.function.arguments);
    if (!args || Array.isArray(args) || typeof args !== "object" || Object.keys(args).length)
      throw new Error("Model cannot supply filters or other arguments");
    return call.function.name as RoutingTool;
  });
  if (new Set(tools).size !== tools.length || !tools.includes("query_metric")) throw new Error("Invalid plan");
  const inputTokens = r.usage?.prompt_tokens;
  const outputTokens = r.usage?.completion_tokens;
  const totalTokens = r.usage?.total_tokens;
  if (!Number.isSafeInteger(inputTokens) || (inputTokens as number) < 0 || (inputTokens as number) > 8192 ||
      !Number.isSafeInteger(outputTokens) || (outputTokens as number) < 0 || (outputTokens as number) > 1024 ||
      totalTokens !== (inputTokens as number) + (outputTokens as number)) throw new Error("Invalid usage");
  return { tools, inputTokens: inputTokens as number, outputTokens: outputTokens as number };
}

export class SyntheticOpenAIProvider implements AssistantProvider {
  constructor(
    private ledger: UsageLedger,
    private config: { baseUrl?: string; apiKey?: string; enabled: boolean },
    private transport: typeof fetch = fetch,
  ) {}
  async route(question: string): Promise<ModelRoute> {
    const canonical = syntheticQuestions.find(q => q.toLowerCase() === question.trim().toLowerCase());
    if (!canonical) throw new DataError("SYNTHETIC_PROMPT_REQUIRED", "Model mode accepts only the four displayed synthetic test questions. Free-text questions remain available in model-free mode.");
    if (!this.config.enabled || !this.config.apiKey || !this.config.baseUrl)
      throw new DataError("MODEL_NOT_CONNECTED", "Managed OpenAI access is not connected/enabled. No provider call was made. Use model-free mode.", 503);
    let base: URL;
    try { base = new URL(this.config.baseUrl); } catch {
      throw new DataError("MODEL_NOT_CONNECTED", "Managed OpenAI access is not configured.", 503);
    }
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash)
      throw new DataError("MODEL_NOT_CONNECTED", "Managed OpenAI access requires a secure server-configured endpoint.", 503);
    const body = JSON.stringify({
      model: "gpt-5-mini", max_completion_tokens: 1024, reasoning_effort: "minimal",
      messages: [
        { role: "system", content: "Select read-only reporting tools for this synthetic question. Always select query_metric. Select all additionally needed tools in this single response. Arguments must be empty; the backend binds the current filters and publication. Do not calculate, answer in prose, supply identifiers, request credentials, or select any write tool." },
        { role: "user", content: canonical },
      ],
      tools: providerTools, tool_choice: "required", parallel_tool_calls: true,
    });
    if (Buffer.byteLength(body, "utf8") > 8192) throw new DataError("MODEL_INPUT_LIMIT", "Model input exceeded the reviewed bound.");
    const reservation = await this.ledger.reserve(); // durable commit before any network call
    const usage: GoodwillAssistantProviderUsage = {
      model: "gpt-5-mini", ...reservation, limitCents: 500, inputTokens: null, outputTokens: null,
    };
    try {
      const response = await this.transport(`${base.toString().replace(/\/$/, "")}/chat/completions`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" }, body,
      });
      if (!response.ok || !response.body) throw new Error("Provider failure");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 32_768) throw new Error("Response limit");
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => undefined); }
      const plan = parseProviderPlan(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      usage.inputTokens = plan.inputTokens; usage.outputTokens = plan.outputTokens;
      return { tools: plan.tools, usage };
    } catch { throw new ProviderAttemptError(usage); }
  }
}