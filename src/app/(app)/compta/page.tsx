import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { effectiveStatus, periodLabel, periodOf, remaining, type InvoiceStatusValue } from "@/core/domain/finance/billing";
import { CURRENCIES, formatMoney } from "@/core/domain/finance/money";
import { can } from "@/core/domain/rbac/role";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle, StatCard } from "@/presentation/components/ui";
import { GenerateButton, PayDialog } from "./compta-controls";
import { loadPayerSummaries } from "./summaries";

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "paid", label: "Payé" },
  { key: "partial", label: "Partiel" },
  { key: "unpaid", label: "Impayé / En retard" },
] as const;

const STATUS_VIEW: Record<InvoiceStatusValue, { label: string; tone: "success" | "info" | "warning" | "danger" }> = {
  PAID: { label: "Payée", tone: "success" },
  PARTIAL: { label: "Partielle", tone: "info" },
  PENDING: { label: "Impayée", tone: "warning" },
  OVERDUE: { label: "En retard", tone: "danger" },
};

const METHOD_LABELS = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", TRANSFER: "Virement" } as const;

const matches = (filter: string | undefined, status: InvoiceStatusValue) =>
  !filter ||
  (filter === "paid" && status === "PAID") ||
  (filter === "partial" && status === "PARTIAL") ||
  (filter === "unpaid" && (status === "PENDING" || status === "OVERDUE"));

export default async function ComptaPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const principal = await requirePagePermission("finance:read");
  const { status: filter } = await searchParams;
  const canWrite = can(principal.role, "finance:write");
  const currency = await getSchoolCurrency(principal.schoolId);
  const symbol = CURRENCIES[currency].symbol;
  const db = tenantPrisma(principal);

  const local = localParts(new Date());
  const today = new Date(local.date);
  const monthStart = new Date(`${periodOf(local.date)}-01T00:00:00.000Z`);

  const [invoices, payments, collected, summaries] = await Promise.all([
    db.invoice.findMany({
      where: { deletedAt: null },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      take: 500,
      include: { student: { select: { firstName: true, lastName: true } } },
    }),
    db.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 8,
      include: { student: { select: { firstName: true, lastName: true } } },
    }),
    db.payment.aggregate({ _sum: { amountCents: true }, where: { paidAt: { gte: monthStart } } }),
    canWrite ? loadPayerSummaries(db, currency) : Promise.resolve([]),
  ]);

  const rows = invoices.map((inv) => ({ inv, status: effectiveStatus(inv, today), carried: inv.carriedToInvoiceId !== null }));
  // Carried invoices are shown for history but excluded from every total.
  const live = rows.filter((r) => !r.carried);
  const outstanding = live.reduce((sum, r) => sum + remaining(r.inv), 0);
  const billed = live.reduce((sum, r) => sum + r.inv.amountCents, 0);
  const recoveryRate = billed === 0 ? 0 : Math.round(((billed - outstanding) / billed) * 100);
  const overdue = live.filter((r) => r.status === "OVERDUE").reduce((sum, r) => sum + remaining(r.inv), 0);
  const visible = rows.filter((r) => r.carried || matches(filter, r.status));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Comptabilité" subtitle={`Mensualités, arriérés et reçus certifiés · ${periodLabel(periodOf(local.date))}`} />
        {canWrite ? (
          <div className="flex flex-wrap items-start gap-3">
            <GenerateButton />
            <PayDialog students={summaries} currency={symbol} defaultDescription={`Mensualité ${periodLabel(periodOf(local.date))}`} />
          </div>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon="💰" tone="mint" label="Encaissé ce mois" value={formatMoney(collected._sum.amountCents ?? 0, currency)} />
        <StatCard index={1} icon="🧾" tone="peach" label="Reste à payer (arriérés cumulés)" value={formatMoney(outstanding, currency)} />
        <StatCard index={2} icon="📈" tone="sky" label="Taux de recouvrement" value={`${recoveryRate} %`} />
        <StatCard index={3} icon="⏰" tone="lilac" label="dont en retard" value={formatMoney(overdue, currency)} />
      </div>

      <nav aria-label="Filtrer par statut" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/compta?status=${f.key}` : "/compta"}
            aria-current={(filter ?? "") === f.key ? "page" : undefined}
            className={`min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
              (filter ?? "") === f.key ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Liste des factures</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Libellé</th>
              <th scope="col" className="px-4 py-3 font-medium">Échéance</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Montant dû</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Payé</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Reste</th>
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ inv, status, carried }) => (
              <tr key={inv.id} className={`border-t border-white/10 ${carried ? "opacity-50" : ""}`}>
                <td className="px-4 py-3">{inv.student.firstName} {inv.student.lastName}</td>
                <td className="px-4 py-3">{inv.label}</td>
                <td className="px-4 py-3 tabular-nums">{inv.dueDate.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(inv.amountCents, currency)}
                  {inv.carriedOverCents > 0 ? (
                    <span className="block text-xs text-peach">dont reliquat {formatMoney(inv.carriedOverCents, currency)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(inv.paidCents, currency)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{carried ? "—" : formatMoney(remaining(inv), currency)}</td>
                <td className="px-4 py-3">
                  {carried ? <Badge tone="info">Reporté</Badge> : <Badge tone={STATUS_VIEW[status].tone}>{STATUS_VIEW[status].label}</Badge>}
                </td>
                <td className="px-4 py-3 text-right">
                  {canWrite && !carried && status !== "PAID" ? (
                    <Link
                      href={`/compta/pay?student=${inv.studentId}`}
                      className="rounded-2xl bg-mint/15 px-4 py-2 text-mint outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Encaisser
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/70">Aucune facture.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Derniers paiements</h2>
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Derniers paiements</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Description</th>
              <th scope="col" className="px-4 py-3 font-medium">Mode</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Montant</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className="px-4 py-3 tabular-nums">{p.paidAt.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3">{p.student.firstName} {p.student.lastName}</td>
                <td className="px-4 py-3">{p.description}</td>
                <td className="px-4 py-3">{METHOD_LABELS[p.method]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.amountCents, currency)}</td>
                <td className="px-4 py-3 text-right">
                  <a href={`/compta/receipt/${p.id}`} className="rounded-2xl bg-sky/15 px-3 py-1.5 text-sky outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    Reçu PDF certifié SHA-256
                  </a>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/70">Aucun paiement enregistré.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
