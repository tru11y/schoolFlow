import { CURRENCIES } from "@/core/domain/finance/money";
import { listLevels } from "@/infrastructure/db/levels";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { EnrollForm } from "./enroll-form";

export default async function NewStudentPage() {
  const principal = await requirePagePermission("user:manage");
  const currency = await getSchoolCurrency(principal.schoolId);
  const levels = await listLevels(tenantPrisma(principal));
  return (
    <>
      <PageTitle title="Nouvelle inscription" subtitle="Fiche élève" />
      <Card className="max-w-3xl">
        <EnrollForm
          currencySymbol={CURRENCIES[currency].symbol}
          levels={levels.map((l) => l.name)}
        />
      </Card>
    </>
  );
}
