import { localParts } from "@/core/domain/attendance/policy";
import { remaining } from "@/core/domain/finance/billing";
import { CURRENCIES, type CurrencyCode } from "@/core/domain/finance/money";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

export interface PayerSummary {
  id: string;
  name: string;
  level: string;
  /** Amounts in major units of the school currency */
  fee: number | null;
  balance: number;
  arrears: number;
}

/** Per student: configured monthly fee, total balance and overdue part, from non-carried invoices only. */
export async function loadPayerSummaries(db: ReturnType<typeof tenantPrisma>, currency: CurrencyCode): Promise<PayerSummary[]> {
  const factor = 10 ** CURRENCIES[currency].exponent;
  const today = new Date(localParts(new Date()).date);

  const [students, levels, invoices] = await Promise.all([
    db.user.findMany({
      where: { role: "STUDENT", deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, profile: { select: { level: true } } },
    }),
    db.gradeLevel.findMany(),
    db.invoice.findMany({
      where: { deletedAt: null, carriedToInvoiceId: null },
      select: { studentId: true, amountCents: true, paidCents: true, dueDate: true },
    }),
  ]);
  const fees = new Map(levels.map((l) => [l.name, l.monthlyFee]));

  return students.map((s) => {
    const mine = invoices.filter((i) => i.studentId === s.id);
    const level = s.profile?.level ?? "";
    const fee = fees.get(level);
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      level,
      fee: fee == null ? null : fee / factor,
      balance: mine.reduce((sum, i) => sum + remaining(i), 0) / factor,
      arrears: mine.filter((i) => i.dueDate < today).reduce((sum, i) => sum + remaining(i), 0) / factor,
    };
  });
}
