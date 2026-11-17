import { CURRENCIES } from "@/core/domain/finance/money";
import { listLevels } from "@/infrastructure/db/levels";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { PageTitle } from "@/presentation/components/ui";
import { EnrollForm } from "./enroll-form";

export default async function NewStudentPage() {
  const principal = await requirePagePermission("user:manage");
  const [levels, currency] = await Promise.all([
    listLevels(tenantPrisma(principal)),
    getSchoolCurrency(principal.schoolId),
  ]);
  return (
    <>
      <PageTitle title="Nouvel élève" subtitle="Informations, scolarité, adresse et parents" />
      <div className="max-w-3xl">
        <EnrollForm levels={levels.map((l) => l.name)} currency={CURRENCIES[currency].symbol} />
      </div>
    </>
  );
}
