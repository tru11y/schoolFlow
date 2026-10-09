"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { COMPETITOR_LEVELS } from "@/core/domain/copilot/competitors";
import { ForbiddenError } from "@/core/domain/errors";
import { toMinorUnits } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../../students/schemas";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

/** A blank or zero fee means "unknown": the level is simply not stored for this competitor. */
const fee = z
  .union([z.literal(""), z.coerce.number().min(0).max(100_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined || v === 0 ? null : v));

const input = z.object({
  id: z.union([z.literal("").transform(() => undefined), z.string().uuid()]).optional(),
  name: text(100),
  area: optional(80),
  contact: optional(120),
  offers: optional(600),
  notes: optional(1000),
  fees: z.array(z.object({ level: z.enum(COMPETITOR_LEVELS), fee })).max(COMPETITOR_LEVELS.length),
});

export const saveCompetitor = secureAction(
  {
    name: "COMPETITOR_SAVED",
    resource: "competitor",
    permission: "copilot:use",
    input,
    resourceId: (_i, data: { id: string }) => data.id,
    auditMetadata: (i) => ({ name: i.name, area: i.area, pricedLevels: i.fees.filter((f) => f.fee !== null).length }),
  },
  async ({ input, db, principal }): Promise<{ id: string }> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const currency = await getSchoolCurrency(schoolId);
    const byLevel = new Map<string, number>();
    for (const f of input.fees) if (f.fee !== null) byLevel.set(f.level, toMinorUnits(f.fee, currency));
    const fees = [...byLevel].map(([level, monthlyFee]) => ({ level, monthlyFee }));
    const data = {
      name: input.name,
      area: input.area ?? null,
      contact: input.contact ?? null,
      offers: input.offers ?? null,
      notes: input.notes ?? null,
    };

    if (!input.id) {
      const created = await db.competitor.create({
        data: { ...data, schoolId, fees: { create: fees.map((f) => ({ schoolId, ...f })) } },
        select: { id: true },
      });
      revalidatePath("/ai-assistant/competitors");
      return created;
    }

    const id = input.id;
    if (!(await db.competitor.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) {
      throw new ForbiddenError("competitor:not-found");
    }
    await db.$transaction([
      db.competitor.update({ where: { id }, data }),
      db.competitorFee.deleteMany({ where: { competitorId: id } }),
      db.competitorFee.createMany({ data: fees.map((f) => ({ schoolId, competitorId: id, ...f })) }),
    ]);
    revalidatePath("/ai-assistant/competitors");
    return { id };
  },
);

export const deleteCompetitor = secureAction(
  {
    name: "COMPETITOR_DELETED",
    resource: "competitor",
    permission: "copilot:use",
    input: z.object({ id: z.string().uuid() }),
    resourceId: (i) => i.id,
  },
  async ({ input, db }) => {
    const { count } = await db.competitor.updateMany({ where: { id: input.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) throw new ForbiddenError("competitor:not-found");
    revalidatePath("/ai-assistant/competitors");
    return { id: input.id };
  },
);
