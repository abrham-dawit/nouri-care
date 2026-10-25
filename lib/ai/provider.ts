import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./labels";

/**
 * Server-side AI provider. Keys are read from the environment on the server only: never sent to
 * the browser, never logged, never stored. Claude is used when ANTHROPIC_API_KEY is set, otherwise
 * OpenAI when OPENAI_API_KEY is set. With neither, callers use the deterministic mock instead.
 */

export type { AIProvider } from "./labels";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 20_000;

export type ProviderInfo = { provider: AIProvider; model: string | null; configured: boolean };

const anthropicKey = () => process.env.ANTHROPIC_API_KEY?.trim() || null;
const openaiKey = () => process.env.OPENAI_API_KEY?.trim() || null;

export function providerInfo(): ProviderInfo {
  if (anthropicKey()) return { provider: "anthropic", model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL, configured: true };
  if (openaiKey()) return { provider: "openai", model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL, configured: true };
  return { provider: "mock", model: null, configured: false };
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
type JSONRequest = { messages: ChatMessage[]; schemaName: string; schema: Record<string, unknown> };

/**
 * One model call constrained to a JSON schema (structured outputs on either provider).
 * Returns the parsed object; the caller must still validate it.
 */
export async function completeJSON<T>(opts: JSONRequest): Promise<T> {
  const info = providerInfo();
  if (info.provider === "anthropic") return completeWithClaude<T>(opts, info.model!);
  if (info.provider === "openai") return completeWithOpenAI<T>(opts, info.model!);
  throw new AIProviderError("No AI key is configured.");
}

let claude: Anthropic | null = null;

/** Rewrites `type: ["x", "null"]` as `anyOf`, the most widely supported way to say "nullable". */
function normalizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (!node || typeof node !== "object") return node;
  const obj = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, normalizeSchema(v)]));
  if (Array.isArray(obj.type)) {
    const { type, ...rest } = obj;
    return { anyOf: (type as string[]).map((t) => (t === "null" ? { type: t } : { ...rest, type: t })) };
  }
  return obj;
}

async function completeWithClaude<T>(opts: JSONRequest, model: string): Promise<T> {
  claude ??= new Anthropic({ apiKey: anthropicKey()!, timeout: TIMEOUT_MS, maxRetries: 1 });
  const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const messages = opts.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  let response: Anthropic.Message;
  try {
    response = await claude.messages.create({
      model,
      max_tokens: 4000,
      system,
      messages,
      // Short, latency-sensitive replies (a device is waiting): keep thinking light.
      output_config: { effort: "low", format: { type: "json_schema", schema: normalizeSchema(opts.schema) as Record<string, unknown> } },
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new AIProviderError("The AI provider rejected the API key.", 401);
    if (err instanceof Anthropic.RateLimitError) throw new AIProviderError("The AI provider rate limit was reached.", 429);
    if (err instanceof Anthropic.APIConnectionTimeoutError) throw new AIProviderError("The AI provider timed out.");
    if (err instanceof Anthropic.APIConnectionError) throw new AIProviderError("Could not reach the AI provider.");
    if (err instanceof Anthropic.APIError) {
      // Log status only: provider error bodies can echo request details.
      console.error(`Claude request failed with status ${err.status}`);
      throw new AIProviderError(`The AI provider returned an error (${err.status}).`, err.status);
    }
    throw err;
  }

  if (response.stop_reason === "refusal") throw new AIProviderError("The AI model declined to respond.");
  if (response.stop_reason === "max_tokens") throw new AIProviderError("The AI response was cut off.");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (!text) throw new AIProviderError("The AI provider returned an empty response.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AIProviderError("The AI provider returned malformed JSON.");
  }
}

async function completeWithOpenAI<T>(opts: JSONRequest, model: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new AIProviderError(timedOut ? "The AI provider timed out." : "Could not reach the AI provider.");
  }

  if (!res.ok) {
    // Log status only: provider error bodies can echo request details.
    console.error(`OpenAI request failed with status ${res.status}`);
    throw new AIProviderError(
      res.status === 401 ? "The AI provider rejected the API key." : res.status === 429 ? "The AI provider rate limit was reached." : `The AI provider returned an error (${res.status}).`,
      res.status,
    );
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
  const message = data.choices?.[0]?.message;
  if (message?.refusal) throw new AIProviderError("The AI model declined to respond.");
  if (!message?.content) throw new AIProviderError("The AI provider returned an empty response.");
  try {
    return JSON.parse(message.content) as T;
  } catch {
    throw new AIProviderError("The AI provider returned malformed JSON.");
  }
}
