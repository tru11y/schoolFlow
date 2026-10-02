"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../../students/schemas";
import { resolveTiming } from "./timing";

const STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
type Status = (typeof STATUSES)[number];

const input = z.object({
  level: text(20),
  records: z.array(z.object({ studentId: z.string().uuid(), status: z.enum(STATUSES) })).min(1).max(200),
});

const idsWith = (records: { studentId: string; status: Status }[], status: Status) =>
  records.filter((r) => r.status === status).map((r) => r.studentId);

export interface TakeAttendanceResult {
  sessionId: string;
  subject: string | null;
  slotId: string | null;
  isOverdue: boolean;
  offsetMinutes: number | null;
  saved: number;
}

export const takeAttendance = secureAction(
  {
    name: "ATTENDANCE_TAKEN",
    resource: "attendance",
    permission: "attendance:write",
    input,
    resourceId: (_i, data: TakeAttendanceResult) => data.sessionId,
    auditSeverity: (_i, data: TakeAttendanceResult) => (data.isOverdue ? "WARNING" : "INFO"),
    // Student ids only (no names) + the schedule gap.
    auditMetadata: (i, data: TakeAttendanceResult | undefined) => ({
      sessionId: data?.sessionId,
      level: i.level,
      subject: data?.subject,
      slotId: data?.slotId,
      IS_LATE_SUBMISSION: data?.isOverdue,
      offsetMinutes: data?.offsetMinutes,
      present: idsWith(i.records, "PRESENT"),
      late: idsWith(i.records, "LATE"),
      absent: idsWith(i.records, "ABSENT"),
    }),
  },
  async ({ input, db, principal }): Promise<TakeAttendanceResult> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const ids = [...new Set(input.records.map((r) => r.studentId))];
    const inClass = await db.user.count({
      where: { id: { in: ids }, role: "STUDENT", deletedAt: null, profile: { level: input.level } },
    });
    if (inClass !== ids.length) throw new ForbiddenError("attendance:foreign-student");

    // Timing is always computed server-side, never taken from the client.
    const now = new Date();
    const { timing, isOverdue, date } = await resolveTiming(db, principal, input.level, now);
    const slot = timing.slot;

    const fields = {
      level: input.level,
      date,
      subject: slot?.subject ?? null,
      recorderId: principal.userId,
      teacherId: slot?.teacherId ?? (principal.role === "TEACHER" ? principal.userId : null),
      submittedAt: now,
      isOverdue,
      offsetMinutes: timing.offsetMinutes,
    };

    let session: { id: string };
    if (slot) {
      session = await db.attendanceSession.upsert({
        where: { slotId_date: { slotId: slot.id, date } },
        update: fields,
        create: { ...fields, schoolId, slotId: slot.id },
        select: { id: true },
      });
    } else {
      const existing = await db.attendanceSession.findFirst({
        where: { slotId: null, level: input.level, date, recorderId: principal.userId },
        select: { id: true },
      });
      session = existing
        ? await db.attendanceSession.update({ where: { id: existing.id }, data: fields, select: { id: true } })
        : await db.attendanceSession.create({ data: { ...fields, schoolId }, select: { id: true } });
    }

    await db.$transaction(
      input.records.map(({ studentId, status }) =>
        db.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId } },
          update: { status },
          create: { schoolId, studentId, sessionId: session.id, date, status },
        }),
      ),
    );

    revalidatePath("/absences");
    revalidatePath("/dashboard");
    return {
      sessionId: session.id,
      subject: slot?.subject ?? null,
      slotId: slot?.id ?? null,
      isOverdue,
      offsetMinutes: timing.offsetMinutes,
      saved: input.records.length,
    };
  },
);
