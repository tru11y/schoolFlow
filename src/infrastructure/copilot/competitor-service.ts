import type { CompetitorView } from "@/core/domain/copilot/competitors";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

type Db = ReturnType<typeof tenantPrisma>;

/** Active competitors of the school with their per-level fees. */
export async function loadCompetitors(db: Db): Promise<CompetitorView[]> {
  const rows = await db.competitor.findMany({
    where: { deletedAt: null },
    orderBy: [{ area: "asc" }, { name: "asc" }],
    include: { fees: { select: { level: true, monthlyFee: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    area: c.area,
    contact: c.contact,
    offers: c.offers,
    notes: c.notes,
    fees: c.fees.map((f) => ({ level: f.level, feeCents: f.monthlyFee })),
  }));
}
