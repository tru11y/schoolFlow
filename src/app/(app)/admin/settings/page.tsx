import { prisma } from "@/infrastructure/db/prisma";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { CurrencyForm } from "./currency-form";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const principal = await requirePagePermission("school:manage");
  const currency = await getSchoolCurrency(principal.schoolId);
  const school = principal.schoolId
    ? await prisma.school.findUnique({ where: { id: principal.schoolId }, select: { name: true, academicYear: true, welcomeMessage: true, logoDataUrl: true } })
    : null;

  return (
    <>
      <PageTitle title="Paramètres" subtitle="Configuration de l'établissement" />
      <div className="grid gap-6">
        {school ? (
          <Card className="max-w-2xl">
            <ProfileForm name={school.name} academicYear={school.academicYear} welcomeMessage={school.welcomeMessage ?? ""} hasLogo={school.logoDataUrl !== null} />
          </Card>
        ) : null}
        <Card className="max-w-2xl">
          <CurrencyForm current={currency} />
          <p className="mt-4 text-xs text-ink/70">
            La devise s&apos;applique à la comptabilité, aux reçus PDF et à la page de vérification. Le passage entre
            devises de décimales différentes (FCFA ↔ EUR) est refusé tant que des factures existent.
          </p>
        </Card>
      </div>
    </>
  );
}
