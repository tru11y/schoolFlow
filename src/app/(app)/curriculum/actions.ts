"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../students/schemas";

export const createChapter = secureAction(
  {
    name: "CHAPTER_CREATED",
    resource: "curriculum",
    permission: "homework:write",
    input: z.object({ level: text(20), subject: text(60), title: text(160) }),
    resourceId: (_i, data: { id: string }) => data.id,
    auditMetadata: (i) => ({ level: i.level, subject: i.subject }),
  },
  async ({ input, db, principal }): Promise<{ id: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const last = await db.curriculumChapter.aggregate({
      where: { level: input.level, subject: input.subject },
      _max: { position: true },
    });
    const chapter = await db.curriculumChapter.create({
      data: { ...input, schoolId, position: (last._max.position ?? 0) + 1 },
      select: { id: true },
    });
    revalidatePath("/curriculum");
    return chapter;
  },
);

export const setChapterDone = secureAction(
  {
    name: "CHAPTER_UPDATED",
    resource: "curriculum",
    permission: "homework:write",
    input: z.object({ id: z.string().uuid(), done: z.boolean() }),
    resourceId: (i) => i.id,
    auditMetadata: (i) => ({ done: i.done }),
  },
  async ({ input, db, principal }) => {
    const chapter = await db.curriculumChapter.findFirst({ where: { id: input.id }, select: { id: true } });
    if (!chapter) throw new ForbiddenError("chapter:not-found");

    await db.curriculumChapter.update({
      where: { id: input.id },
      data: input.done ? { completedAt: new Date(), completedById: principal.userId } : { completedAt: null, completedById: null },
    });
    revalidatePath("/curriculum");
    revalidatePath("/students", "layout");
    return { id: input.id };
  },
);
