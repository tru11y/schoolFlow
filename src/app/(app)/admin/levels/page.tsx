import { CURRENCIES } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { AddLevel, LevelRow } from "./level-controls";

export default async function LevelsPage() {
  const principal = await requirePagePermission("user:manage");
  const db = tenantPrisma(principal);
  const currency = await getSchoolCurrency(principal.schoolId);
  const { exponent, symbol } = CURRENCIES[currency];

  const [levels, counts] = await Promise.all([
    db.gradeLevel.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.studentProfile.groupBy({ by: ["level"], _count: { _all: true } }),
  ]);
  const used = new Map(counts.map((c) => [c.level, c._count._all]));

  return (
    <>
      <PageTitle title="Niveaux et classes" subtitle="Les niveaux alimentent les filtres, l'inscription et les programmes" />
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Ajouter un niveau</h2>
        <AddLevel currency={symbol} />
      </Card>
      <Card>
        <ul className="grid gap-2">
          {levels.map((l) => (
            <LevelRow
              key={l.id}
              id={l.id}
              name={l.name}
              feeMajor={l.monthlyFee === null ? null : l.monthlyFee / 10 ** exponent}
              currency={symbol}
              used={used.get(l.name) ?? 0}
            />
          ))}
          {levels.length === 0 ? <li className="text-ink/70">Aucun niveau.</li> : null}
        </ul>
      </Card>
    </>
  );
}
