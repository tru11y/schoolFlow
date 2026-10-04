import { describe, expect, it } from "vitest";
import type { AssistantReply } from "./assistant";
import { AI_UNAVAILABLE_NOTE, mergeAiResult } from "./chat-merge";

const local: AssistantReply = { intent: "help", text: "Voici ce que je sais faire.", items: [] };

describe("mergeAiResult", () => {
  it("returns the model answer when there is one", () => {
    expect(mergeAiResult(local, { text: "Réponse Claude", failed: false })).toEqual({ intent: "ai", text: "Réponse Claude", items: [] });
  });

  it("keeps the local reply silently when no model is configured", () => {
    expect(mergeAiResult(local, { text: null, failed: false })).toBe(local);
  });

  it("falls back to the local reply with a visible note when the model failed", () => {
    const merged = mergeAiResult(local, { text: null, failed: true });
    expect(merged.text.startsWith(AI_UNAVAILABLE_NOTE)).toBe(true);
    expect(merged.text).toContain(local.text);
    expect(merged.intent).toBe("help");
  });
});
