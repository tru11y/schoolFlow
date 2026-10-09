import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { PageTitle } from "@/presentation/components/ui";
import { EnrollForm } from "./enroll-form";

export default async function NewStudentPage() {
  const principal = await requirePagePermission("user:manage");
  const levels = await listLevels(tenantPrisma(principal));
  return (
    <>
      <PageTitle title="Nouvel élève" subtitle="Informations, scolarité, adresse et parents" />
      <div className="max-w-3xl">
        <EnrollForm levels={levels.map((l) => l.name)} />
      </div>
    </>
  );
}
