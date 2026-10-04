import type { Principal } from "@/core/domain/auth/principal";
import { answer, type AssistantReply } from "@/core/domain/copilot/assistant";
import { mergeAiResult } from "@/core/domain/copilot/chat-merge";
import { askClaude } from "./claude-assistant";
import { loadSnapshot } from "./copilot-service";

/**
 * Known topics keep their deterministic reply (with one-click links, zero token).
 * Anything else goes to the model; if it is missing or fails, the local reply is returned instead.
 */
export async function replyTo(principal: Principal, question: string): Promise<AssistantReply> {
  const snapshot = await loadSnapshot(principal);
  const local = answer(question, snapshot);
  if (local.intent !== "help") return local;
  return mergeAiResult(local, await askClaude(question, snapshot));
}
