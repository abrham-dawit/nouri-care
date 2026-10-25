/** Shared by server and browser code: which AI produced something, and how to name it. */

export type AIProvider = "anthropic" | "openai" | "mock";

const NAMES: Record<AIProvider, string> = { anthropic: "Claude", openai: "OpenAI", mock: "rule-based mock" };

export const providerName = (provider: AIProvider) => NAMES[provider];

/** "Claude (claude-opus-5-5)", "OpenAI (gpt-4.1-mini)" or "rule-based mock". */
export const providerLabel = (provider: AIProvider, model?: string | null) => (provider === "mock" || !model ? NAMES[provider] : `${NAMES[provider]} (${model})`);
