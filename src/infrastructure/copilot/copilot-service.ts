import { localParts } from "@/core/domain/attendance/policy";
import type { Principal } from "@/core/domain/auth/principal";
import { flagAbsentees, splitBalances } from "@/core/domain/copilot/rules";
import type {
  Contact, CopilotSnapshot, StudentAbsenceFlag, StudentArrear, TeacherPunctuality,
} from "@/core/domain/copilot/types";
import { toMinutes } from "@/core/domain/students/timetable";
import { prisma } from "@/infrastructure/db/prisma";
import { loadCompetitors } from "./competitor-service";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

const DAY_MS = 86_400_000;
const PUNCTUALITY_WINDOW_DAYS = 30;
const ATTENDANCE_WINDOW_DAYS = 7;
/** A logbook / roll call is due this long after the slot ends. */
export const GRACE_MINUTES = 30;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const shiftDate = (date: string, days: number) => isoDate(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS));
const isoWeekday = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

type ParentRow = { name: string; phone: string | null; email: string | null; position: number };
const primaryParent = (parents: ParentRow[]): Contact | null => {
  const p = [...parents].sort((a, b) => a.position - b.position)[0];
  return p ? { name: p.name, phone: p.phone, email: p.email } : null;
};

const studentSelect = {
  firstName: true, lastName: true,
  profile: { select: { level: true } },
  parents: { select: { name: true, phone: true, email: true, position: true } },
} as const;

/** Reads the school state the copilot reasons on. Tenant-scoped through `tenantPrisma`. */
export async function loadSnapshot(principal: Principal, now: Date = new Date()): Promise<CopilotSnapshot> {
  if (!principal.schoolId) throw new Error("tenant:missing");
  const db = tenantPrisma(principal);
  const local = localParts(now);
  const today = new Date(local.date);

  const [school, invoices, weekRecords, levelRows, students] = await Promise.all([
    prisma.school.findUniqueOrThrow({ where: { id: principal.schoolId }, select: { name: true, currency: true } }),
    db.invoice.findMany({
      where: { deletedAt: null, carriedToInvoiceId: null, status: { not: "PAID" } },
      select: { studentId: true, amountCents: true, paidCents: true, dueDate: true, student: { select: studentSelect } },
    }),
    db.attendanceRecord.findMany({
      where: { date: { gte: new Date(shiftDate(local.date, -(ATTENDANCE_WINDOW_DAYS - 1))), lte: today }, status: { not: "PRESENT" } },
      select: { studentId: true, status: true, student: { select: studentSelect } },
    }),
    db.gradeLevel.findMany({ select: { name: true, monthlyFee: true }, orderBy: { position: "asc" } }),
    db.studentProfile.findMany({ where: { status: "ACTIVE", user: { deletedAt: null } }, select: { level: true } }),
  ]);

  const { overdue, upcoming } = splitBalances(invoices, today);
  const studentById = new Map(invoices.map((i) => [i.studentId, i.student]));
  const toArrear = (map: typeof overdue): StudentArrear[] =>
    [...map.entries()]
      .map(([studentId, b]) => {
        const s = studentById.get(studentId)!;
        return {
          studentId, studentName: fullName(s), level: s.profile?.level ?? "—", owedCents: b.owed, oldestDue: b.oldest,
          parent: primaryParent(s.parents),
        };
      })
      .sort((a, b) => b.owedCents - a.owedCents);

  const flags = flagAbsentees(weekRecords.map((r) => ({ studentId: r.studentId, status: r.status })));
  const recordById = new Map(weekRecords.map((r) => [r.studentId, r.student]));
  const absences: StudentAbsenceFlag[] = [...flags.entries()]
    .map(([studentId, c]) => {
      const s = recordById.get(studentId)!;
      return { studentId, studentName: fullName(s), level: s.profile?.level ?? "—", ...c, parent: primaryParent(s.parents) };
    })
    .sort((a, b) => b.absences + b.lates - (a.absences + a.lates));

  const fees = new Map(levelRows.map((l) => [l.name, l.monthlyFee]));
  const sizes = new Map(levelRows.map((l) => [l.name, 0]));
  for (const s of students) sizes.set(s.level, (sizes.get(s.level) ?? 0) + 1);

  return {
    schoolName: school.name,
    currency: school.currency,
    arrears: toArrear(overdue),
    upcoming: toArrear(upcoming),
    absences,
    teachers: await teacherPunctuality(principal, now),
    levels: [...sizes.entries()].map(([level, count]) => ({ level, students: count, feeCents: fees.get(level) ?? null })),
    competitors: await loadCompetitors(db),
  };
}

/** Compares each class slot occurrence of the last 30 days with the roll calls and logbook entries recorded for it. */
export async function teacherPunctuality(principal: Principal, now: Date = new Date()): Promise<TeacherPunctuality[]> {
  const db = tenantPrisma(principal);
  const local = localParts(now);
  const from = shiftDate(local.date, -(PUNCTUALITY_WINDOW_DAYS - 1));

  const [slots, sessions, logbook] = await Promise.all([
    db.timetableSlot.findMany({
      where: { teacherId: { not: null }, level: { not: null } },
      select: { id: true, weekday: true, endTime: true, createdAt: true, teacher: { select: { id: true, firstName: true, lastName: true, deletedAt: true } } },
    }),
    db.attendanceSession.findMany({ where: { date: { gte: new Date(from) }, slotId: { not: null } }, select: { slotId: true, date: true, isOverdue: true } }),
    db.logbookEntry.findMany({ where: { date: { gte: new Date(from) }, slotId: { not: null } }, select: { slotId: true, date: true } }),
  ]);

  const sessionAt = new Map(sessions.map((s) => [`${s.slotId}|${isoDate(s.date)}`, s]));
  const logAt = new Set(logbook.map((l) => `${l.slotId}|${isoDate(l.date)}`));
  const stats = new Map<string, TeacherPunctuality>();

  for (let offset = -(PUNCTUALITY_WINDOW_DAYS - 1); offset <= 0; offset++) {
    const date = shiftDate(local.date, offset);
    const weekday = isoWeekday(date);
    for (const slot of slots) {
      if (slot.weekday !== weekday || !slot.teacher || slot.teacher.deletedAt) continue;
      if (isoDate(slot.createdAt) > date) continue;
      if (date === local.date && local.minutes < toMinutes(slot.endTime) + GRACE_MINUTES) continue;

      const t = stats.get(slot.teacher.id) ?? {
        teacherId: slot.teacher.id, teacherName: fullName(slot.teacher),
        expectedSessions: 0, missedRollCalls: 0, lateRollCalls: 0, missingLogbook: 0,
      };
      t.expectedSessions++;
      const session = sessionAt.get(`${slot.id}|${date}`);
      if (!session) t.missedRollCalls++;
      else if (session.isOverdue) t.lateRollCalls++;
      if (!logAt.has(`${slot.id}|${date}`)) t.missingLogbook++;
      stats.set(slot.teacher.id, t);
    }
  }
  return [...stats.values()];
}
