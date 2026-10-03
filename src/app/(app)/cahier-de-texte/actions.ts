"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localParts } from "@/core/domain/attendance/policy";
import { ForbiddenError } from "@/core/domain/errors";
import { canWriteScope } from "@/core/domain/logbook/logbook";
import { TIME_RE } from "@/core/domain/students/timetable";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../students/schemas";
import { loadWriteScopes } from "./scopes";

const blank = <T extends z.ZodType>(schema: T) => z.union([z.literal("").transform(() => undefined), schema]).optional();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const input = z.object({
  id: blank(z.string().uuid()),
  level: text(20),
  subject: text(60),
  date: day,
  slotId: blank(z.string().uuid()),
  startTime: blank(z.string().regex(TIME_RE)),
  endTime: blank(z.string().regex(TIME_RE)),
  title: text(160),
  content: text(5000),
  homework: blank(z.string().trim().max(2000)),
  homeworkDue: blank(day),
  chapterId: blank(z.string().uuid()),
  chapterDone: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export const saveLogbookEntry = secureAction(
  {
    name: "LOGBOOK_ENTRY_SAVED",
    resource: "logbook",
    permission: "homework:write",
    input,
    resourceId: (_i, data: { id: string }) => data.id,
    auditMetadata: (i) => ({ level: i.level, subject: i.subject, date: i.date, slotId: i.slotId, chapterId: i.chapterId }),
  },
  async ({ input, db, principal }): Promise<{ id: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");
    const isTeacher = principal.role === "TEACHER";

    if (!(await db.gradeLevel.findFirst({ where: { name: input.level }, select: { id: true } }))) {
      throw new ForbiddenError("logbook:unknown-level");
    }
    if (isTeacher) {
      const { scopes } = await loadWriteScopes(db, principal);
      if (!canWriteScope(scopes, input.level, input.subject)) throw new ForbiddenError("logbook:scope");
    }

    // Entries can be dated today or in the past (up to 120 days), never in the future.
    const today = localParts(new Date()).date;
    const oldest = new Date(new Date(`${today}T00:00:00Z`).getTime() - 120 * 86_400_000).toISOString().slice(0, 10);
    if (input.date > today || input.date < oldest) throw new ForbiddenError("logbook:date");

    let startTime = input.startTime;
    let endTime = input.endTime;
    if (input.slotId) {
      const slot = await db.timetableSlot.findFirst({ where: { id: input.slotId } });
      if (!slot || slot.level !== input.level || slot.subject !== input.subject) throw new ForbiddenError("logbook:slot");
      if (isTeacher && slot.teacherId !== principal.userId) throw new ForbiddenError("logbook:slot");
      startTime ??= slot.startTime;
      endTime ??= slot.endTime;
    }

    const chapter = input.chapterId ? await db.curriculumChapter.findFirst({ where: { id: input.chapterId } }) : null;
    if (input.chapterId && (!chapter || chapter.level !== input.level || chapter.subject !== input.subject)) {
      throw new ForbiddenError("logbook:chapter");
    }

    const date = new Date(`${input.date}T00:00:00.000Z`);
    const data = {
      level: input.level,
      subject: input.subject,
      date,
      slotId: input.slotId ?? null,
      startTime: startTime ?? null,
      endTime: endTime ?? null,
      title: input.title,
      content: input.content,
      homework: input.homework ?? null,
      homeworkDue: input.homeworkDue ? new Date(`${input.homeworkDue}T00:00:00.000Z`) : null,
      chapterId: input.chapterId ?? null,
    };

    // Update an explicit entry, or the one already written for this slot and day; otherwise create.
    const existing = input.id
      ? await db.logbookEntry.findFirst({ where: { id: input.id } })
      : input.slotId
        ? await db.logbookEntry.findFirst({ where: { slotId: input.slotId, date } })
        : null;
    if (input.id && !existing) throw new ForbiddenError("logbook:not-found");
    if (existing && isTeacher && existing.teacherId !== principal.userId) throw new ForbiddenError("logbook:not-owner");

    const saved = existing
      ? await db.logbookEntry.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.logbookEntry.create({ data: { ...data, schoolId, teacherId: principal.userId }, select: { id: true } });

    if (chapter && input.chapterDone && !chapter.completedAt) {
      await db.curriculumChapter.update({ where: { id: chapter.id }, data: { completedAt: new Date(), completedById: principal.userId } });
    }

    revalidatePath("/cahier-de-texte");
    revalidatePath("/curriculum");
    return saved;
  },
);
