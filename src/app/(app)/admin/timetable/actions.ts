"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { parseTimetableCsv } from "@/core/domain/timetable/import";
import { secureAction } from "@/presentation/secure-action";

const normalize = (s: string): string =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

export interface ImportSummary {
  created: number;
  skipped: number;
  unknownTeachers: string[];
  unknownLevels: string[];
  errors: { line: number; message: string }[];
}

export const importTimetable = secureAction(
  {
    name: "timetable.import",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ csv: z.string().min(1).max(200_000), replace: z.boolean().default(false) }),
    resourceId: () => null,
    auditMetadata: (i) => ({ replace: i.replace }),
  },
  async ({ input, db, principal }): Promise<ImportSummary> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const { columns, rows, errors } = parseTimetableCsv(input.csv);
    if (!columns) {
      throw new ForbiddenError("timetable:bad-columns");
    }

    const [levels, teachers] = await Promise.all([
      db.gradeLevel.findMany({ select: { name: true } }),
      db.user.findMany({ where: { role: "TEACHER", deletedAt: null }, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const levelSet = new Set(levels.map((l) => l.name));
    const teacherByName = new Map<string, string>();
    for (const t of teachers) {
      teacherByName.set(normalize(`${t.firstName} ${t.lastName}`), t.id);
      teacherByName.set(normalize(`${t.lastName} ${t.firstName}`), t.id);
    }

    const unknownLevels = new Set<string>();
    const unknownTeachers = new Set<string>();
    const toCreate: {
      schoolId: string; level: string; weekday: number; startTime: string; endTime: string;
      subject: string; teacherId: string | null; room: string | null;
    }[] = [];

    for (const row of rows) {
      if (!levelSet.has(row.level)) { unknownLevels.add(row.level); continue; }
      let teacherId: string | null = null;
      if (row.teacherName) {
        teacherId = teacherByName.get(normalize(row.teacherName)) ?? null;
        if (!teacherId) unknownTeachers.add(row.teacherName);
      }
      toCreate.push({
        schoolId, level: row.level, weekday: row.weekday, startTime: row.startTime,
        endTime: row.endTime, subject: row.subject, teacherId, room: row.room,
      });
    }

    const affectedLevels = [...new Set(toCreate.map((s) => s.level))];
    let skipped = 0;
    let created = 0;

    await db.$transaction(async (tx) => {
      if (input.replace && affectedLevels.length) {
        // Replace the class timetable for every level present in the file (student-specific slots untouched).
        await tx.timetableSlot.deleteMany({ where: { studentId: null, level: { in: affectedLevels } } });
      }
      const existing = input.replace
        ? new Set<string>()
        : new Set(
            (await tx.timetableSlot.findMany({
              where: { studentId: null, level: { in: affectedLevels } },
              select: { level: true, weekday: true, startTime: true, subject: true },
            })).map((s) => `${s.level}|${s.weekday}|${s.startTime}|${s.subject}`),
          );

      const seen = new Set<string>();
      const fresh = toCreate.filter((s) => {
        const key = `${s.level}|${s.weekday}|${s.startTime}|${s.subject}`;
        if (existing.has(key) || seen.has(key)) { skipped++; return false; }
        seen.add(key);
        return true;
      });
      if (fresh.length) {
        const res = await tx.timetableSlot.createMany({ data: fresh });
        created = res.count;
      }
    });

    revalidatePath("/admin/timetable");
    return {
      created,
      skipped,
      unknownTeachers: [...unknownTeachers],
      unknownLevels: [...unknownLevels],
      errors,
    };
  },
);
