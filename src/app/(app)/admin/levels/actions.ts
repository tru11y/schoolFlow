"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { toMinorUnits } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { prisma } from "@/infrastructure/db/prisma";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../../students/schemas";

const fee = z
  .union([z.literal(""), z.coerce.number().min(0).max(100_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export type LevelResult = { status: "ok"; id: string } | { status: "exists" } | { status: "in_use"; count: number };

export const createLevel = secureAction(
  {
    name: "LEVEL_CREATED",
    resource: "level",
    permission: "user:manage",
    input: z.object({ name: text(40), monthlyFee: fee }),
    resourceId: (_i, data: LevelResult) => (data.status === "ok" ? data.id : null),
    auditMetadata: (i) => ({ name: i.name }),
  },
  async ({ input, db, principal }): Promise<LevelResult> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");
    if (await db.gradeLevel.findFirst({ where: { name: input.name }, select: { id: true } })) return { status: "exists" };

    const last = await db.gradeLevel.aggregate({ _max: { position: true } });
    const currency = await getSchoolCurrency(schoolId);
    const level = await db.gradeLevel.create({
      data: {
        schoolId,
        name: input.name,
        position: (last._max.position ?? -1) + 1,
        monthlyFee: input.monthlyFee === null ? null : toMinorUnits(input.monthlyFee, currency),
      },
      select: { id: true },
    });
    revalidatePath("/admin/levels");
    return { status: "ok", id: level.id };
  },
);

export const updateLevel = secureAction(
  {
    name: "LEVEL_UPDATED",
    resource: "level",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid(), name: text(40), monthlyFee: fee }),
    resourceId: (i) => i.id,
    auditMetadata: (i) => ({ name: i.name }),
  },
  async ({ input, db }): Promise<LevelResult> => {
    const level = await db.gradeLevel.findFirst({ where: { id: input.id } });
    if (!level) throw new ForbiddenError("level:not-found");
    const { schoolId } = level;
    const rename = input.name !== level.name;
    if (rename && (await db.gradeLevel.findFirst({ where: { name: input.name, schoolId }, select: { id: true } }))) {
      return { status: "exists" };
    }

    const currency = await getSchoolCurrency(schoolId);
    // Other tables reference the level by name: a rename must cascade atomically.
    await prisma.$transaction([
      prisma.gradeLevel.update({
        where: { id: level.id },
        data: { name: input.name, monthlyFee: input.monthlyFee === null ? null : toMinorUnits(input.monthlyFee, currency) },
      }),
      ...(rename
        ? [
            prisma.studentProfile.updateMany({ where: { schoolId, level: level.name }, data: { level: input.name } }),
            prisma.timetableSlot.updateMany({ where: { schoolId, level: level.name }, data: { level: input.name } }),
            prisma.curriculumChapter.updateMany({ where: { schoolId, level: level.name }, data: { level: input.name } }),
            prisma.attendanceSession.updateMany({ where: { schoolId, level: level.name }, data: { level: input.name } }),
            prisma.$executeRaw`UPDATE users SET "classLevels" = array_replace("classLevels", ${level.name}, ${input.name}) WHERE "schoolId" = ${schoolId}::uuid`,
          ]
        : []),
    ]);
    revalidatePath("/", "layout");
    return { status: "ok", id: level.id };
  },
);

export const deleteLevel = secureAction(
  {
    name: "LEVEL_DELETED",
    resource: "level",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid() }),
    resourceId: (i) => i.id,
  },
  async ({ input, db }): Promise<LevelResult> => {
    const level = await db.gradeLevel.findFirst({ where: { id: input.id } });
    if (!level) throw new ForbiddenError("level:not-found");

    const where = { schoolId: level.schoolId, level: level.name };
    const [students, slots, chapters] = await Promise.all([
      prisma.studentProfile.count({ where }),
      prisma.timetableSlot.count({ where }),
      prisma.curriculumChapter.count({ where }),
    ]);
    const count = students + slots + chapters;
    if (count > 0) return { status: "in_use", count };

    await db.gradeLevel.deleteMany({ where: { id: level.id } });
    revalidatePath("/admin/levels");
    return { status: "ok", id: level.id };
  },
);
