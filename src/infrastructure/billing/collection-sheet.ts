import { effectiveStatus, remaining } from "@/core/domain/finance/billing";
import { localParts } from "@/core/domain/attendance/policy";
import { formatMoney } from "@/core/domain/finance/money";
import { prisma } from "../db/prisma";
import { getSchoolCurrency } from "../db/school";

const INVOICE_STATUS = { PAID: "Payée", PARTIAL: "Partielle", PENDING: "Impayée", OVERDUE: "En retard" } as const;

export interface CollectionSheet {
  headers: string[];
  rows: unknown[][];
  rowCount: number;
  totalDueCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
}

/**
 * Monthly collection sheet for a school: every active student's owed amount for `period`,
 * already paid, and what is left to collect. Falls back to the resolved monthly fee for
 * students not yet invoiced. Reads the raw `prisma` client, scoped explicitly by `schoolId`.
 */
export async function buildCollectionSheet(schoolId: string, period: string, level?: string): Promise<CollectionSheet> {
  const today = new Date(localParts(new Date()).date);
  const [students, levels, invoices, currency] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "STUDENT", deletedAt: null, isActive: true, profile: { status: "ACTIVE", ...(level ? { level } : {}) } },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, profile: { select: { level: true, monthlyFeeCents: true } } },
    }),
    prisma.gradeLevel.findMany({ where: { schoolId }, select: { name: true, monthlyFee: true } }),
    prisma.invoice.findMany({
      where: { schoolId, period, deletedAt: null, carriedToInvoiceId: null },
      select: { studentId: true, amountCents: true, carriedOverCents: true, paidCents: true, dueDate: true },
    }),
    getSchoolCurrency(schoolId),
  ]);

  const feeOf = new Map(levels.map((l) => [l.name, l.monthlyFee]));
  const invoiceOf = new Map(invoices.map((i) => [i.studentId, i]));
  const money = (c: number) => formatMoney(c, currency, "code");

  let totalDueCents = 0;
  let totalPaidCents = 0;
  let totalRemainingCents = 0;

  const rows = students.map((s) => {
    const inv = invoiceOf.get(s.id);
    if (inv) {
      const rem = remaining(inv);
      totalDueCents += inv.amountCents;
      totalPaidCents += inv.paidCents;
      totalRemainingCents += rem;
      return [
        s.profile?.level ?? "", s.lastName, s.firstName,
        money(inv.amountCents - inv.carriedOverCents), money(inv.amountCents), money(inv.paidCents),
        money(rem), INVOICE_STATUS[effectiveStatus(inv, today)], inv.dueDate,
      ];
    }
    const fee = s.profile?.monthlyFeeCents ?? feeOf.get(s.profile?.level ?? "") ?? 0;
    totalDueCents += fee;
    totalRemainingCents += fee;
    return [
      s.profile?.level ?? "", s.lastName, s.firstName,
      money(fee), money(fee), money(0), money(fee), "Non facturé", "",
    ];
  });

  return {
    headers: ["Classe", "Nom", "Prénom", "Mensualité", "Montant dû", "Déjà payé", "Reste à encaisser", "Statut", "Échéance"],
    rows,
    rowCount: rows.length,
    totalDueCents,
    totalPaidCents,
    totalRemainingCents,
  };
}
