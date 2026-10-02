import { can } from "@/core/domain/rbac/role";
import { formatEuros } from "@/core/domain/finance/receipt";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { PayButton } from "./pay-button";

export default async function ComptaPage() {
  const principal = await requirePagePermission("finance:read");
  const canWrite = can(principal.role, "finance:write");
  const invoices = await tenantPrisma(principal).invoice.findMany({
    where: { deletedAt: null },
    orderBy: { dueDate: "asc" },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  return (
    <>
      <PageTitle title="Comptabilité" subtitle="Factures et reçus certifiés" />
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Liste des factures</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Libellé</th>
              <th scope="col" className="px-4 py-3 font-medium">Échéance</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Montant</th>
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-white/10">
                <td className="px-4 py-3">{inv.student.firstName} {inv.student.lastName}</td>
                <td className="px-4 py-3">{inv.label}</td>
                <td className="px-4 py-3 tabular-nums">{inv.dueDate.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatEuros(inv.amountCents)}</td>
                <td className="px-4 py-3">
                  <Badge tone={inv.status === "PAID" ? "success" : "warning"}>
                    {inv.status === "PAID" ? "Payée" : "En attente"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {inv.status === "PAID" ? (
                    <a
                      href={`/compta/receipt/${inv.id}`}
                      className="rounded-2xl bg-sky/15 px-4 py-2 text-sky outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Reçu PDF certifié SHA-256
                    </a>
                  ) : canWrite ? (
                    <PayButton invoiceId={inv.id} />
                  ) : null}
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/70">Aucune facture.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
