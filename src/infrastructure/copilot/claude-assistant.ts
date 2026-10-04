import Anthropic from "@anthropic-ai/sdk";
import { buildLlmContext, COPILOT_SYSTEM_PROMPT, restoreNames } from "@/core/domain/copilot/llm-context";
import type { CopilotSnapshot } from "@/core/domain/copilot/types";
import { chatApiKey, clean } from "./llm-env";

/** Org-level keys need the workspace header; the SDK sends these headers on every request. */
const workspaceHeaders = (): Record<string, string> =>
  clean(process.env.ANTHROPIC_WORKSPACE_ID) ? { "anthropic-workspace-id": clean(process.env.ANTHROPIC_WORKSPACE_ID)! } : {};

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export const llmEnabled = (): boolean => Boolean(chatApiKey());

let client: Anthropic | undefined;

/**
 * Free-form answer grounded on the pseudonymized school snapshot.
 * Returns null on any failure or refusal so the caller can fall back to the rule-based reply.
 */
export async function askClaude(question: string, snapshot: CopilotSnapshot): Promise<{ text: string | null; failed: boolean }> {
  // No key: the copilot is purely local, which is a normal state and not a failure.
  if (!llmEnabled()) return { text: null, failed: false };
  const { text: context, names } = buildLlmContext(snapshot);
  try {
    client ??= new Anthropic({ apiKey: chatApiKey(), defaultHeaders: workspaceHeaders(), timeout: 20_000, maxRetries: 0 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: COPILOT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Données de l'établissement :\n${context}\n\nQuestion : ${question}` }],
    });
    if (response.stop_reason === "refusal") return { text: null, failed: false };
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return answer ? { text: restoreNames(answer, names), failed: false } : { text: null, failed: true };
  } catch (err) {
    // Status and provider message only (never the key or the prompt).
    console.error(
      "copilot llm failed",
      MODEL,
      err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err instanceof Error ? err.message : "unknown",
    );
    return { text: null, failed: true };
  }
}

/** Minimal call used by the health check: status only, no school data. */
export async function pingChat(): Promise<{ configured: boolean; model: string; ok?: boolean; error?: string }> {
  if (!llmEnabled()) return { configured: false, model: MODEL };
  try {
    client ??= new Anthropic({ apiKey: chatApiKey(), defaultHeaders: workspaceHeaders(), timeout: 20_000, maxRetries: 0 });
    const res = await client.messages.create({ model: MODEL, max_tokens: 5, messages: [{ role: "user", content: "ping" }] });
    return { configured: true, model: MODEL, ok: res.content.length > 0 };
  } catch (err) {
    return {
      configured: true, model: MODEL, ok: false,
      error: err instanceof Anthropic.APIError ? `${err.status} ${err.message}`.slice(0, 400) : "unknown",
    };
  }
}
