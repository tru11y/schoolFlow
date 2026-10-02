import { getSchoolCurrency } from "@/infrastructure/db/school";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { CurrencyForm } from "./currency-form";

export default async function SettingsPage() {
  const principal = await requirePagePermission("school:manage");
  const currency = await getSchoolCurrency(principal.schoolId);

  return (
    <>
      <PageTitle title="Paramètres" subtitle="Configuration de l'établissement" />
      <Card className="max-w-2xl">
        <CurrencyForm current={currency} />
        <p className="mt-4 text-xs text-ink/70">
          La devise s&apos;applique à la comptabilité, aux reçus PDF et à la page de vérification. Le passage entre
          devises de décimales différentes (FCFA ↔ EUR) est refusé tant que des factures existent.
        </p>
      </Card>
    </>
  );
}
