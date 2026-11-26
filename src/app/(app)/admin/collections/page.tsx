import { periodLabel } from "@/core/domain/finance/billing";
import { formatMoney } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";

export const metadata = { title: "Feuilles d'encaissement · SchoolFlow" };

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });

export default async function CollectionSheetsPage() {
  const principal = await requirePagePermission("finance:write");
  const db = tenantPrisma(principal);
  const [sheets, currency] = await Promise.all([
    db.collectionSheet.findMany({
      orderBy: { generatedAt: "desc" },
      take: 36,
      select: { id: true, period: true, generatedAt: true, rowCount: true, totalDueCents: true, totalPaidCents: true, totalRemainingCents: true },
    }),
    getSchoolCurrency(principal.schoolId),
  ]);
  const money = (c: number) => formatMoney(c, currency, "code");

  return (
    <>
      <PageTitle
        title="Feuilles d'encaissement"
        subtitle="Figées en fin de mois. Téléchargez le CSV pour encaisser manuellement."
      />
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Feuilles d&apos;encaissement mensuelles</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Mois</th>
              <th scope="col" className="px-4 py-3 font-medium">Générée le</th>
              <th scope="col" className="px-4 py-3 font-medium">Élèves</th>
              <th scope="col" className="px-4 py-3 font-medium">Montant dû</th>
              <th scope="col" className="px-4 py-3 font-medium">Payé</th>
              <th scope="col" className="px-4 py-3 font-medium">Reste</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Télécharger</span></th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s) => (
              <tr key={s.id} className="border-t border-ink/10">
                <td className="px-4 py-3 font-medium">{periodLabel(s.period)}</td>
                <td className="px-4 py-3">{fmt.format(s.generatedAt)}</td>
                <td className="px-4 py-3 tabular-nums">{s.rowCount}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.totalDueCents)}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.totalPaidCents)}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.totalRemainingCents)}</td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/api/collections/${s.id}`}
                    download
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-surface px-4 py-2 text-sm outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
                  >
                    <span aria-hidden>⬇️</span> CSV
                  </a>
                </td>
              </tr>
            ))}
            {sheets.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink/70">Aucune feuille d&apos;encaissement pour l&apos;instant. La première sera générée en fin de mois.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
