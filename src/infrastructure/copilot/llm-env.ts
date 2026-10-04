import type { Llm } from "@/core/application/copilot/report";
import { readLlm } from "./llm";

interface Vars {
  AI_PROVIDER?: "anthropic" | "openai" | undefined;
  AI_API_KEY?: string | undefined;
  AI_MODEL?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  ANTHROPIC_WORKSPACE_ID?: string | undefined;
}

/**
 * Single place that decides which model backs the copilot summaries.
 * ANTHROPIC_API_KEY or AI_API_KEY both work; a bare ANTHROPIC_API_KEY implies the anthropic provider.
 * null = no usable key: the copilot stays purely local.
 */
export function llmFromEnv(e: Vars): Llm | null {
  const anthropicKey = clean(e.ANTHROPIC_API_KEY);
  return readLlm({
    AI_PROVIDER: e.AI_PROVIDER ?? (anthropicKey ? "anthropic" : undefined),
    AI_API_KEY: clean(e.AI_API_KEY) ?? anthropicKey,
    AI_MODEL: clean(e.AI_MODEL),
    ANTHROPIC_WORKSPACE_ID: clean(e.ANTHROPIC_WORKSPACE_ID),
  });
}

/** Pasted secrets often carry a trailing newline or space, which makes providers answer "invalid key". */
export const clean = (v: string | undefined): string | undefined => v?.trim().replace(/^["']|["']$/g, "") || undefined;

/** The key the free-form chat (Anthropic SDK) uses: ANTHROPIC_API_KEY, else AI_API_KEY when the provider is anthropic. */
export function chatApiKey(e: Record<string, string | undefined> = process.env): string | undefined {
  const anthropic = clean(e.ANTHROPIC_API_KEY);
  if (anthropic) return anthropic;
  return (e.AI_PROVIDER ?? "anthropic") === "anthropic" ? clean(e.AI_API_KEY) : undefined;
}
