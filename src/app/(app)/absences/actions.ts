"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { secureAction } from "@/presentation/secure-action";

/** Soft delete: restorable from /admin/trash. */
export const deleteAttendanceSession = secureAction(
  {
    name: "ATTENDANCE_SESSION_DELETED",
    resource: "attendance",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid() }),
    resourceId: (i) => i.id,
  },
  async ({ input, db }) => {
    const { count } = await db.attendanceSession.updateMany({ where: { id: input.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) throw new ForbiddenError("attendance:not-found");
    revalidatePath("/absences");
    revalidatePath("/admin/trash");
    return { id: input.id };
  },
);
