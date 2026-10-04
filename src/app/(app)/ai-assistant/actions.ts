"use server";

import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { answer, type AssistantReply } from "@/core/domain/copilot/assistant";
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
    return answer(input.question, await loadSnapshot(principal));
  },
);
