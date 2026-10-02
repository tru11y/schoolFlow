"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { CURRENCIES, CURRENCY_CODES } from "@/core/domain/finance/money";
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
