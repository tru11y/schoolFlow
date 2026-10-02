"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { secureAction } from "@/presentation/secure-action";

export const createHomework = secureAction(
  {
    name: "homework.create",
    resource: "homework",
    permission: "homework:write",
    input: z.object({ title: z.string().trim().min(1).max(120), content: z.string().trim().min(1).max(5000) }),
  },
  async ({ input, db, principal }) => {
    if (!principal.schoolId) throw new ForbiddenError("tenant:missing");
    const note = await db.homework.create({
      data: { ...input, authorId: principal.userId, schoolId: principal.schoolId },
      select: { id: true },
    });
    revalidatePath("/cahier-de-texte");
    return note;
  },
);
