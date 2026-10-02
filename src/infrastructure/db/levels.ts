import type { tenantPrisma } from "./tenant-prisma";

export interface LevelOption {
  id: string;
  name: string;
  monthlyFee: number | null;
}

/** Levels configured by the school, in display order. */
export async function listLevels(db: ReturnType<typeof tenantPrisma>): Promise<LevelOption[]> {
  return db.gradeLevel.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, monthlyFee: true },
  });
}
