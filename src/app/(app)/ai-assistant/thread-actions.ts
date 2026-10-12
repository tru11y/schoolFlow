"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { threadTitleSchema } from "@/core/domain/copilot/threads";
import { ForbiddenError } from "@/core/domain/errors";
import { secureAction } from "@/presentation/secure-action";

const id = z.string().uuid();

export const renameThread = secureAction(
  {
    name: "COPILOT_THREAD_RENAMED",
    resource: "copilot_thread",
    permission: "copilot:use",
    input: z.object({ id, title: threadTitleSchema }),
    resourceId: (i) => i.id,
  },
  async ({ input, db, principal }) => {
    const { count } = await db.copilotThread.updateMany({
      where: { id: input.id, userId: principal.userId, deletedAt: null },
      data: { title: input.title },
    });
    if (count === 0) throw new ForbiddenError("thread:not-found");
    revalidatePath("/ai-assistant");
    return { id: input.id };
  },
);

/** Soft delete: the thread disappears from the history, rows are kept. */
export const deleteThread = secureAction(
  {
    name: "COPILOT_THREAD_DELETED",
    resource: "copilot_thread",
    permission: "copilot:use",
    input: z.object({ id }),
    resourceId: (i) => i.id,
  },
  async ({ input, db, principal }) => {
    const { count } = await db.copilotThread.updateMany({
      where: { id: input.id, userId: principal.userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new ForbiddenError("thread:not-found");
    revalidatePath("/ai-assistant");
    return { id: input.id };
  },
);
