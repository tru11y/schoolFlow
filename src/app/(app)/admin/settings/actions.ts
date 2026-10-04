"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { CURRENCIES, CURRENCY_CODES } from "@/core/domain/finance/money";
import { welcomeMessageSchema } from "@/core/domain/school/branding";
import { logoDataUrlSchema } from "@/core/domain/school/logo";
import { prisma } from "@/infrastructure/db/prisma";
import { secureAction } from "@/presentation/secure-action";

export const updateSchoolSettings = secureAction(
  {
    name: "SCHOOL_UPDATED",
    resource: "school",
    permission: "school:manage",
    input: z.object({ currency: z.enum(CURRENCY_CODES) }),
    resourceId: (_i, data: { schoolId: string }) => data.schoolId,
    auditMetadata: (i) => ({ currency: i.currency }),
  },
  async ({ input, principal }): Promise<{ schoolId: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { currency: true } });
    const current = CURRENCIES[school.currency as keyof typeof CURRENCIES]?.exponent ?? 2;
    // Stored amounts are minor units: switching decimals would silently rescale existing invoices.
    if (CURRENCIES[input.currency].exponent !== current && (await prisma.invoice.count({ where: { schoolId } })) > 0) {
      throw new ForbiddenError("currency:exponent-change-with-invoices");
    }

    await prisma.school.update({ where: { id: schoolId }, data: { currency: input.currency } });
    revalidatePath("/", "layout");
    return { schoolId };
  },
);

export const updateSchoolProfile = secureAction(
  {
    name: "SCHOOL_PROFILE_UPDATED",
    resource: "school",
    permission: "school:manage",
    input: z.object({
      name: z.string().trim().min(2).max(80),
      academicYear: z.string().trim().regex(/^\d{4} - \d{4}$/),
      welcomeMessage: welcomeMessageSchema.optional(),
      logoDataUrl: logoDataUrlSchema,
    }),
    resourceId: (_i, data: { schoolId: string }) => data.schoolId,
    auditMetadata: (i) => ({ name: i.name, logo: i.logoDataUrl === undefined ? "unchanged" : i.logoDataUrl ? "set" : "removed" }),
  },
  async ({ input, principal }): Promise<{ schoolId: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    await prisma.school.update({
      where: { id: schoolId },
      data: { name: input.name, academicYear: input.academicYear, ...(input.welcomeMessage === undefined ? {} : { welcomeMessage: input.welcomeMessage }), ...(input.logoDataUrl === undefined ? {} : { logoDataUrl: input.logoDataUrl }) },
    });
    revalidatePath("/", "layout");
    return { schoolId };
  },
);
