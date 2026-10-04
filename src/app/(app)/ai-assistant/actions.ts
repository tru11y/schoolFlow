"use server";

import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { answer, type AssistantReply } from "@/core/domain/copilot/assistant";
import { askClaude } from "@/infrastructure/copilot/claude-assistant";
import { loadSnapshot } from "@/infrastructure/copilot/copilot-service";
import { secureAction } from "@/presentation/secure-action";

export const askCopilot = secureAction(
  {
    name: "COPILOT_ASKED",
    resource: "copilot",
    permission: "user:manage",
    input: z.object({ question: z.string().trim().min(2).max(300) }),
    resourceId: () => null,
    // The question may name students or parents: only the detected intent is logged.
    auditMetadata: (_i, data: AssistantReply | undefined) => ({ intent: data?.intent }),
  },
  async ({ input, principal }): Promise<AssistantReply> => {
    if (!principal.schoolId) throw new ForbiddenError("tenant:missing");
    const snapshot = await loadSnapshot(principal);
    const reply = answer(input.question, snapshot);
    // Known topics keep their deterministic reply (with one-click links); anything else goes to Claude.
    if (reply.intent !== "help") return reply;
    const text = await askClaude(input.question, snapshot);
    return text ? { intent: "ai", text, items: [] } : reply;
  },
);
