import type { Principal } from "@/core/domain/auth/principal";
import { teacherScopes, type Scope } from "@/core/domain/logbook/logbook";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

type Db = ReturnType<typeof tenantPrisma>;

/** (class, subject) pairs the user may log. Admins and SuperAdmins are unrestricted (`all`). */
export async function loadWriteScopes(db: Db, principal: Principal): Promise<{ all: boolean; scopes: Scope[] }> {
  if (principal.role !== "TEACHER") return { all: true, scopes: [] };
  const [slots, me] = await Promise.all([
    db.timetableSlot.findMany({ where: { teacherId: principal.userId, level: { not: null } }, select: { level: true, subject: true } }),
    db.user.findFirst({ where: { id: principal.userId }, select: { classLevels: true, specialty: true } }),
  ]);
  return { all: false, scopes: teacherScopes(slots, me?.classLevels ?? [], me?.specialty ?? null) };
}

/** Classes whose logbook the user may read: own class(es) for students/parents, assigned classes for teachers, all for admins. */
export async function loadReadableLevels(db: Db, principal: Principal, allLevels: string[]): Promise<string[]> {
  switch (principal.role) {
    case "STUDENT": {
      const profile = await db.studentProfile.findFirst({ where: { userId: principal.userId }, select: { level: true } });
      return profile ? [profile.level] : [];
    }
    case "PARENT": {
      const links = await db.guardianLink.findMany({ where: { parentId: principal.userId }, select: { studentId: true } });
      const profiles = await db.studentProfile.findMany({
        where: { userId: { in: links.map((l) => l.studentId) } },
        select: { level: true },
        distinct: ["level"],
      });
      return profiles.map((p) => p.level);
    }
    case "TEACHER": {
      const { scopes } = await loadWriteScopes(db, principal);
      const levels = new Set(scopes.map((s) => s.level));
      return allLevels.filter((l) => levels.has(l));
    }
    default:
      return allLevels;
  }
}
