import type { AssistantReply } from "./assistant";

export const AI_UNAVAILABLE_NOTE = "L'assistant IA est momentanément indisponible, voici l'analyse locale.";
export const CHAT_FAILURE_REPLY: AssistantReply = {
  intent: "help",
  text: "L'assistant IA est momentanément indisponible et l'analyse locale n'a pas pu être calculée. Réessayez dans un instant.",
  items: [],
};

/**
 * Combines the deterministic reply with the model result:
 * model text when available; otherwise the local reply, with a visible note only if the model was expected to answer.
 */
export function mergeAiResult(local: AssistantReply, ai: { text: string | null; failed: boolean }): AssistantReply {
  if (ai.text) return { intent: "ai", text: ai.text, items: [] };
  return ai.failed ? { ...local, text: `${AI_UNAVAILABLE_NOTE}\n\n${local.text}` } : local;
}
