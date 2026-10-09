"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { toMinorUnits } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { ENROLLMENT_STATUSES } from "@/core/domain/students/student";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { secureAction } from "@/presentation/secure-action";
import { parentsSchema, slotSchema, text } from "./schemas";

const createInput = z.object({
  firstName: text(60),
  lastName: text(60),
  level: text(20),
  address: text(200),
  parents: parentsSchema,
  /** One-off enrollment fee in major units; 0 creates no invoice. Monthly billing comes from the level fee. */
  enrollmentFee: z.coerce.number().min(0).max(100_000).default(0),
});

export type CreateStudentResult = { status: "created"; id: string; login: string; tempPassword: string };

export const createStudent = secureAction(
  {
    name: "student.enroll",
    resource: "student",
    permission: "user:manage",
    input: createInput,
    resourceId: (_input, data: CreateStudentResult) => data.id,
    // No address / contact details in the audit log.
    auditMetadata: (i) => ({ level: i.level, enrollmentFee: i.enrollmentFee, parents: i.parents.length }),
  },
  async ({ input, db, principal }): Promise<CreateStudentResult> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    // Students sign in with a generated internal identifier; no personal e-mail is collected.
    const login = `eleve.${randomBytes(6).toString("hex")}@schoolflow.local`;
    const tempPassword = randomBytes(9).toString("base64url");
    const feeCents = toMinorUnits(input.enrollmentFee, await getSchoolCurrency(schoolId));

    const user = await db.user.create({
      data: {
        email: login,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "STUDENT",
        passwordHash: await new Argon2Hasher().hash(tempPassword),
        schoolId,
        profile: {
          create: { schoolId, level: input.level, address: input.address, status: "ACTIVE" },
        },
        parents: { create: input.parents.map((p, position) => ({ schoolId, position, ...p })) },
        invoices: {
          create: feeCents > 0 ? [{ schoolId, label: "Frais d'inscription", amountCents: feeCents, dueDate: new Date(new Date().toISOString().slice(0, 10)) }] : [],
        },
      },
      select: { id: true },
    });

    revalidatePath("/students");
    return { status: "created", id: user.id, login, tempPassword };
  },
);

export const updateStudent = secureAction(
  {
    name: "student.update",
    resource: "student",
    permission: "user:manage",
    input: z.object({
      id: z.string().uuid(),
      level: text(20),
      address: text(200),
      status: z.enum(ENROLLMENT_STATUSES),
      parents: parentsSchema,
    }),
    resourceId: (input) => input.id,
    auditMetadata: (i) => ({ level: i.level, status: i.status, parents: i.parents.length }),
  },
  async ({ input, db, principal }) => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const student = await db.user.findFirst({ where: { id: input.id, role: "STUDENT", deletedAt: null }, select: { id: true } });
    if (!student) throw new ForbiddenError("student:not-found");

    const { id, parents, ...profile } = input;
    await db.$transaction([
      db.studentProfile.update({ where: { userId: id }, data: profile }),
      ...parents.map((p, position) =>
        db.parentContact.upsert({
          where: { studentId_position: { studentId: id, position } },
          update: { ...p, phone: p.phone ?? null, email: p.email ?? null },
          create: { schoolId, studentId: id, position, ...p },
        }),
      ),
      db.parentContact.deleteMany({ where: { studentId: id, position: { gte: parents.length } } }),
    ]);

    revalidatePath("/students");
    revalidatePath(`/students/${id}`);
    return { id };
  },
);

export const saveSlot = secureAction(
  {
    name: "timetable.save",
    resource: "timetable",
    permission: "user:manage",
    input: slotSchema,
    resourceId: (input) => input.id ?? null,
    auditMetadata: (i) => ({ studentId: i.studentId, scope: i.scope, weekday: i.weekday, subject: i.subject, start: i.startTime, end: i.endTime }),
  },
  async ({ input, db, principal }) => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const student = await db.user.findFirst({
      where: { id: input.studentId, role: "STUDENT", deletedAt: null },
      select: { id: true, profile: { select: { level: true } } },
    });
    if (!student) throw new ForbiddenError("student:not-found");

    if (input.teacherId && !(await db.user.findFirst({ where: { id: input.teacherId, role: "TEACHER", deletedAt: null } }))) {
      throw new ForbiddenError("teacher:not-found");
    }
    const level = student.profile?.level ?? null;
    if (input.chapterId) {
      const chapter = await db.curriculumChapter.findFirst({ where: { id: input.chapterId }, select: { level: true } });
      if (!chapter || chapter.level !== level) throw new ForbiddenError("chapter:not-found");
    }
    if (input.scope === "class" && !level) throw new ForbiddenError("student:no-level");

    const data = {
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      subject: input.subject,
      teacherId: input.teacherId ?? null,
      room: input.room ?? null,
      curriculumChapterId: input.chapterId ?? null,
      level: input.scope === "class" ? level : null,
      studentId: input.scope === "student" ? student.id : null,
    };

    if (input.id) {
      if (!(await db.timetableSlot.findFirst({ where: { id: input.id }, select: { id: true } }))) {
        throw new ForbiddenError("slot:not-found");
      }
      await db.timetableSlot.update({ where: { id: input.id }, data });
    } else {
      await db.timetableSlot.create({ data: { ...data, schoolId } });
    }
    revalidatePath(`/students/${student.id}`);
    return { ok: true };
  },
);

export const deleteSlot = secureAction(
  {
    name: "timetable.delete",
    resource: "timetable",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid(), studentId: z.string().uuid() }),
    resourceId: (input) => input.id,
  },
  async ({ input, db }) => {
    const { count } = await db.timetableSlot.deleteMany({ where: { id: input.id } });
    if (count === 0) throw new ForbiddenError("slot:not-found");
    revalidatePath(`/students/${input.studentId}`);
    return { ok: true };
  },
);
