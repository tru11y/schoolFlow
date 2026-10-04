import type { Llm } from "@/core/application/copilot/report";

export const DEFAULT_MODELS = { anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini" } as const;
/** Hard cap on the completion: keeps every report cheap. */
export const MAX_OUTPUT_TOKENS = 350;
const TIMEOUT_MS = 20_000;

type Provider = keyof typeof DEFAULT_MODELS;

export interface LlmEnv {
  AI_PROVIDER?: Provider | undefined;
  AI_API_KEY?: string | undefined;
  AI_MODEL?: string | undefined;
}

/** null (copilot stays 100% local) unless a provider and a key are configured. */
export function readLlm(env: LlmEnv, fetchImpl: typeof fetch = fetch): Llm | null {
  if (!env.AI_PROVIDER || !env.AI_API_KEY) return null;
  const provider = env.AI_PROVIDER;
  const model = env.AI_MODEL ?? DEFAULT_MODELS[provider];
  const key = env.AI_API_KEY;

  return {
    model,
    async complete(system, user) {
      if (provider === "anthropic") {
        const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3, system, messages: [{ role: "user", content: user }] }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`anthropic ${res.status}`);
        const body = (await res.json()) as { content?: { type: string; text?: string }[] };
        return body.content?.find((c) => c.type === "text")?.text ?? "";
      }
      const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`openai ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content ?? "";
    },
  };
}
