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
export async function askClaude(question: string, snapshot: CopilotSnapshot): Promise<string | null> {
  if (!llmEnabled()) return null;
  const { text: context, names } = buildLlmContext(snapshot);
  try {
    client ??= new Anthropic({ timeout: 30_000, maxRetries: 1 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: COPILOT_SYSTEM_PROMPT,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `Données de l'établissement :\n${context}\n\nQuestion : ${question}` }],
    });
    if (response.stop_reason === "refusal") return null;
    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return answer ? restoreNames(answer, names) : null;
  } catch (err) {
    console.error("copilot llm failed", err instanceof Anthropic.APIError ? err.status : "unknown");
    return null;
  }
}
