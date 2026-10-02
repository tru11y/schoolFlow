import type { Principal } from "@/core/domain/auth/principal";
import { evaluateTiming, isOverdueSubmission, localParts } from "@/core/domain/attendance/policy";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

type Db = ReturnType<typeof tenantPrisma>;

/**
 * Which slot does this roll call fall into? Teachers are matched against their own slots for the class;
 * admins against any slot of the class (informational, never overdue).
 */
export async function resolveTiming(db: Db, principal: Principal, level: string, now: Date) {
  const slots = await db.timetableSlot.findMany({
    where: { level, ...(principal.role === "TEACHER" ? { teacherId: principal.userId } : {}) },
  });
  const timing = evaluateTiming(slots, now);
  return {
    timing,
    isOverdue: isOverdueSubmission(principal.role, timing),
    date: new Date(localParts(now).date),
  };
}
