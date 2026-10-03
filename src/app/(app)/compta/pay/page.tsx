import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { periodLabel, periodOf } from "@/core/domain/finance/billing";
import { CURRENCIES } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { PaymentForm } from "../payment-form";
import { loadPayerSummaries } from "../summaries";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const principal = await requirePagePermission("finance:write");
  const { student } = await searchParams;
  const currency = await getSchoolCurrency(principal.schoolId);
  const students = await loadPayerSummaries(tenantPrisma(principal), currency);

  return (
    <>
      <Link href="/compta" className="mb-4 inline-block text-sm text-ink/70 hover:text-ink">← Comptabilité</Link>
      <PageTitle title="Encaissement rapide" subtitle="Enregistrer un versement et générer le reçu certifié" />
      <Card className="max-w-2xl">
        <PaymentForm
          key={student ?? "none"}
          students={students}
          currency={CURRENCIES[currency].symbol}
          defaultDescription={`Mensualité ${periodLabel(periodOf(localParts(new Date()).date))}`}
          preselect={students.some((s) => s.id === student) ? student : undefined}
        />
      </Card>
    </>
  );
}
