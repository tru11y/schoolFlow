import type { Principal } from "@/core/domain/auth/principal";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

type Db = ReturnType<typeof tenantPrisma>;

/**
 * The set of students whose financial records a principal may see.
 * - PARENT: only their own children (via guardian links).
 * - Everyone else holding finance access (staff): unrestricted.
 *
 * `all: false` with an empty `studentIds` means "scoped to nobody" — callers
 * must treat it as an empty result, never as "no filter".
 */
export async function financeStudentScope(
  db: Db,
  principal: Principal,
): Promise<{ all: true } | { all: false; studentIds: string[] }> {
  if (principal.role !== "PARENT") return { all: true };
  const links = await db.guardianLink.findMany({
    where: { parentId: principal.userId },
    select: { studentId: true },
  });
  return { all: false, studentIds: links.map((l) => l.studentId) };
}

/** Prisma `where` fragment restricting a `studentId` column to the scope, or `{}` when unrestricted. */
export function studentScopeWhere(
  scope: { all: true } | { all: false; studentIds: string[] },
): { studentId: { in: string[] } } | Record<string, never> {
  return scope.all ? {} : { studentId: { in: scope.studentIds } };
}
