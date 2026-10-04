import type { Llm } from "@/core/application/copilot/report";

export const DEFAULT_MODELS = { anthropic: "claude-haiku-4-5-20251001", openai: "gpt-4o-mini" } as const;
/** Hard cap on the completion: keeps every report cheap. */
export const MAX_OUTPUT_TOKENS = 350;
const TIMEOUT_MS = 20_000;

type Provider = keyof typeof DEFAULT_MODELS;

/** HTTP 400/404 from the provider: the model name was rejected (auth and rate-limit errors are not retried). */
class ProviderError extends Error {
  constructor(provider: string, readonly status: number, detail: string) {
    super(`${provider} ${status} ${detail}`.trim());
  }
}

const isUnknownModel = (err: Error): boolean => err instanceof ProviderError && (err.status === 404 || err.status === 400);

/** Provider error body, trimmed: it explains the rejection and never contains our key. */
const detailOf = async (res: Response): Promise<string> => (await res.text().catch(() => "")).slice(0, 300);

export interface LlmEnv {
  AI_PROVIDER?: Provider | undefined;
  AI_API_KEY?: string | undefined;
  AI_MODEL?: string | undefined;
  ANTHROPIC_WORKSPACE_ID?: string | undefined;
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
      try {
        return await request(model, system, user);
      } catch (err) {
        // A retired or mistyped model name must not disable the copilot: retry once with the known-good default.
        const fallback = DEFAULT_MODELS[provider];
        if (model !== fallback && err instanceof Error && isUnknownModel(err)) return request(fallback, system, user);
        throw err;
      }
    },
  };

  async function request(model: string, system: string, user: string): Promise<string> {
      if (provider === "anthropic") {
        const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            ...(env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } : {}),
          },
          body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3, system, messages: [{ role: "user", content: user }] }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new ProviderError("anthropic", res.status, await detailOf(res));
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
      if (!res.ok) throw new ProviderError("openai", res.status, await detailOf(res));
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return body.choices?.[0]?.message?.content ?? "";
  }
}
