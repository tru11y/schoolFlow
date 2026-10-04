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
  return readLlm({
    AI_PROVIDER: e.AI_PROVIDER ?? (e.ANTHROPIC_API_KEY ? "anthropic" : undefined),
    AI_API_KEY: e.AI_API_KEY ?? e.ANTHROPIC_API_KEY,
    AI_MODEL: e.AI_MODEL,
    ANTHROPIC_WORKSPACE_ID: e.ANTHROPIC_WORKSPACE_ID,
  });
}

/** The key the free-form chat (Anthropic SDK) uses: ANTHROPIC_API_KEY, else AI_API_KEY when the provider is anthropic. */
export function chatApiKey(e: Record<string, string | undefined> = process.env): string | undefined {
  if (e.ANTHROPIC_API_KEY) return e.ANTHROPIC_API_KEY;
  return e.AI_API_KEY && (e.AI_PROVIDER ?? "anthropic") === "anthropic" ? e.AI_API_KEY : undefined;
}
