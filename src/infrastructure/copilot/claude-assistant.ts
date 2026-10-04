import Anthropic from "@anthropic-ai/sdk";
import { buildLlmContext, COPILOT_SYSTEM_PROMPT, restoreNames } from "@/core/domain/copilot/llm-context";
import type { CopilotSnapshot } from "@/core/domain/copilot/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export const llmEnabled = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

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
    client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
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
