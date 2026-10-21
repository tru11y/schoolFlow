"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { canManageRole } from "@/core/domain/rbac/user-management";
import { secureAction } from "@/presentation/secure-action";
import { TRASH_KINDS } from "./kinds";

/** Restores any soft-deleted resource listed in the trash. */
export const restoreItem = secureAction(
  {
    name: "TRASH_RESTORED",
    resource: "trash",
    permission: "user:manage",
    input: z.object({ kind: z.enum(TRASH_KINDS), id: z.string().uuid() }),
    resourceId: (i) => i.id,
    auditMetadata: (i) => ({ kind: i.kind }),
  },
  async ({ input, db, principal }) => {
    const where = { id: input.id, deletedAt: { not: null } };
    const data = { deletedAt: null };
    let count: number;
    switch (input.kind) {
      case "user": {
        const target = await db.user.findFirst({ where, select: { role: true } });
        if (!target || !canManageRole(principal.role, target.role)) throw new ForbiddenError("trash:not-found");
        ({ count } = await db.user.updateMany({ where, data: { ...data, isActive: true } }));
        break;
      }
      case "chapter": ({ count } = await db.curriculumChapter.updateMany({ where, data })); break;
      case "logbook": ({ count } = await db.logbookEntry.updateMany({ where, data })); break;
      case "attendance": ({ count } = await db.attendanceSession.updateMany({ where, data })); break;
      case "competitor": ({ count } = await db.competitor.updateMany({ where, data })); break;
    }
    if (count === 0) throw new ForbiddenError("trash:not-found");
    for (const path of ["/admin/trash", "/admin/users", "/students", "/curriculum", "/cahier-de-texte", "/absences", "/ai-assistant/competitors"]) revalidatePath(path);
    return { id: input.id };
  },
);
