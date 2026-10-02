"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { ROLES } from "@/core/domain/rbac/role";
import { SWITCHABLE_ROLES, canManageRole, splitFullName } from "@/core/domain/rbac/user-management";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import type { Principal } from "@/core/domain/auth/principal";
import { prisma } from "@/infrastructure/db/prisma";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { secureAction } from "@/presentation/secure-action";
import { parentsSchema, text } from "../../students/schemas";

const fullName = z
  .string()
  .trim()
  .max(120)
  .refine((v) => splitFullName(v) !== null, "Prénom et nom requis");

const base = {
  fullName,
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10, "10 caractères minimum").max(128),
  phone: z.string().trim().max(30).optional().transform((v) => v || undefined),
};

const createInput = z.discriminatedUnion("role", [
  z.object({ ...base, role: z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"]) }),
  z.object({
    ...base,
    role: z.literal("TEACHER"),
    specialty: text(60),
    classLevels: z.array(text(20)).max(10).default([]),
  }),
  z.object({
    ...base,
    role: z.literal("STUDENT"),
    level: text(20),
    address: text(200),
    parents: parentsSchema,
  }),
  z.object({ ...base, role: z.literal("PARENT"), studentId: z.string().uuid() }),
]);

export type CreateUserResult = { status: "created"; id: string } | { status: "email_taken" };

const hasher = new Argon2Hasher();

export const createUser = secureAction(
  {
    name: "USER_CREATED",
    resource: "user",
    permission: "user:manage",
    input: createInput,
    resourceId: (_i, data: CreateUserResult) => (data.status === "created" ? data.id : null),
    // Role and email only: no password, phone, address or contacts in the audit log.
    auditMetadata: (i) => ({ role: i.role, email: i.email }),
  },
  async ({ input, db, principal }): Promise<CreateUserResult> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");
    if (!canManageRole(principal.role, input.role)) throw new ForbiddenError("role:escalation");

    // Unique across the platform: look it up without the tenant filter.
    if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      return { status: "email_taken" };
    }
    if (input.role === "PARENT") {
      const child = await db.user.findFirst({ where: { id: input.studentId, role: "STUDENT", deletedAt: null }, select: { id: true } });
      if (!child) throw new ForbiddenError("student:not-found");
    }

    const names = splitFullName(input.fullName)!;
    const common = {
      email: input.email,
      ...names,
      phone: input.phone ?? null,
      role: input.role,
      schoolId,
      passwordHash: await hasher.hash(input.password),
    };

    const user = await db.user.create({
      data: {
        ...common,
        ...(input.role === "TEACHER" ? { specialty: input.specialty, classLevels: input.classLevels } : {}),
        ...(input.role === "STUDENT"
          ? {
              profile: { create: { schoolId, level: input.level, address: input.address, status: "ACTIVE" } },
              parents: { create: input.parents.map((p, position) => ({ schoolId, position, ...p })) },
            }
          : {}),
        ...(input.role === "PARENT" ? { guardianOf: { create: { schoolId, studentId: input.studentId } } } : {}),
      },
      select: { id: true },
    });

    revalidatePath("/admin/users");
    return { status: "created", id: user.id };
  },
);

/** Loads the target and enforces: same tenant (via db), no self-service, no escalation. */
async function loadManageable(db: ReturnType<typeof tenantPrisma>, principal: Principal, id: string) {
  if (id === principal.userId) throw new ForbiddenError("user:self");
  const target = await db.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, role: true, isActive: true } });
  if (!target) throw new ForbiddenError("user:not-found");
  if (!canManageRole(principal.role, target.role)) throw new ForbiddenError("role:escalation");
  return target;
}

const revokeSessions = (userId: string) =>
  prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const setUserActive = secureAction(
  {
    name: "USER_UPDATED",
    resource: "user",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid(), active: z.boolean() }),
    resourceId: (i) => i.id,
    auditMetadata: (i) => ({ change: i.active ? "activated" : "deactivated" }),
  },
  async ({ input, db, principal }) => {
    await loadManageable(db, principal, input.id);
    await db.user.update({ where: { id: input.id }, data: { isActive: input.active } });
    if (!input.active) await revokeSessions(input.id);
    revalidatePath("/admin/users");
    return { id: input.id };
  },
);

export const changeUserRole = secureAction(
  {
    name: "USER_UPDATED",
    resource: "user",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid(), role: z.enum(SWITCHABLE_ROLES) }),
    resourceId: (i) => i.id,
    auditMetadata: (i) => ({ change: "role", role: i.role }),
  },
  async ({ input, db, principal }) => {
    const target = await loadManageable(db, principal, input.id);
    if (!ROLES.includes(input.role) || !canManageRole(principal.role, input.role)) throw new ForbiddenError("role:escalation");
    if (target.role === "STUDENT") throw new ForbiddenError("role:student-locked");
    await db.user.update({ where: { id: input.id }, data: { role: input.role } });
    revalidatePath("/admin/users");
    return { id: input.id };
  },
);

export const resetUserPassword = secureAction(
  {
    name: "USER_UPDATED",
    resource: "user",
    permission: "user:manage",
    input: z.object({ id: z.string().uuid() }),
    resourceId: (i) => i.id,
    auditMetadata: () => ({ change: "password_reset" }),
  },
  async ({ input, db, principal }) => {
    await loadManageable(db, principal, input.id);
    const tempPassword = randomBytes(9).toString("base64url");
    await db.user.update({ where: { id: input.id }, data: { passwordHash: await hasher.hash(tempPassword) } });
    await revokeSessions(input.id);
    return { tempPassword };
  },
);
