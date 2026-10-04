import type { Principal } from "@/core/domain/auth/principal";
import { groupSiblings, type GrowthSnapshot } from "@/core/domain/copilot/benchmark";
import { prisma } from "@/infrastructure/db/prisma";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

/** Deterministic read of what the benchmark needs (fees, class sizes, session fill, families). Zero tokens. */
export async function loadGrowth(principal: Principal): Promise<GrowthSnapshot> {
  if (!principal.schoolId) throw new Error("tenant:missing");
  const db = tenantPrisma(principal);

  const [school, levels, profiles, courses, contacts] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: principal.schoolId }, select: { currency: true } }),
    db.gradeLevel.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { name: true, monthlyFee: true } }),
    db.studentProfile.findMany({ where: { status: "ACTIVE", user: { deletedAt: null } }, select: { level: true } }),
    db.course.findMany({ select: { name: true, weekday: true, startTime: true, _count: { select: { enrollments: true } } } }),
    db.parentContact.findMany({
      where: { student: { deletedAt: null, profile: { status: "ACTIVE" } } },
      select: { studentId: true, phone: true, email: true },
    }),
  ]);

  const sizes = new Map<string, number>();
  for (const p of profiles) sizes.set(p.level, (sizes.get(p.level) ?? 0) + 1);
  const siblings = groupSiblings(contacts);

  return {
    currency: school.currency,
    levels: levels.map((l) => ({ level: l.name, feeCents: l.monthlyFee, students: sizes.get(l.name) ?? 0 })),
    courses: courses.map((c) => ({ name: c.name, weekday: c.weekday, startTime: c.startTime, enrolled: c._count.enrollments })),
    siblingFamilies: siblings.families,
    siblingStudents: siblings.students,
  };
}
