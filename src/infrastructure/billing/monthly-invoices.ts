import { Prisma } from "@prisma/client";
import { periodDueDate, periodLabel, periodOf, planMonthlyInvoice } from "@/core/domain/finance/billing";
import { localParts } from "@/core/domain/attendance/policy";
import { prisma } from "../db/prisma";

export interface GenerationResult {
  period: string;
  created: number;
  alreadyBilled: number;
  skippedNoFee: number;
  carriedOverCents: number;
}

/**
 * Creates this month's invoice for every ACTIVE student of the school (idempotent: one per student and month).
 * Each new amount = the level's monthly fee + the unpaid balance of earlier invoices, which are then marked as
 * carried so the debt is never counted twice. Past-due unpaid invoices are flagged OVERDUE.
 */
export async function generateMonthlyInvoices(schoolId: string, now: Date = new Date()): Promise<GenerationResult> {
  const local = localParts(now);
  const period = periodOf(local.date);
  const today = new Date(local.date);
  const dueDate = periodDueDate(period);

  const [students, levels, existing] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "STUDENT", deletedAt: null, isActive: true, profile: { status: "ACTIVE" } },
      select: { id: true, profile: { select: { level: true } } },
    }),
    prisma.gradeLevel.findMany({ where: { schoolId } }),
    prisma.invoice.findMany({ where: { schoolId, period }, select: { studentId: true } }),
  ]);
  const fees = new Map(levels.map((l) => [l.name, l.monthlyFee]));
  const billed = new Set(existing.map((i) => i.studentId));

  const result: GenerationResult = { period, created: 0, alreadyBilled: 0, skippedNoFee: 0, carriedOverCents: 0 };

  for (const student of students) {
    if (billed.has(student.id)) {
      result.alreadyBilled++;
      continue;
    }
    const fee = fees.get(student.profile?.level ?? "");
    if (!fee) {
      result.skippedNoFee++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const previous = await tx.invoice.findMany({
          where: {
            studentId: student.id, schoolId, deletedAt: null, carriedToInvoiceId: null,
            OR: [{ period: null }, { period: { not: period } }],
          },
          select: { id: true, amountCents: true, paidCents: true },
        });
        const plan = planMonthlyInvoice(fee, previous);
        const invoice = await tx.invoice.create({
          data: {
            schoolId, studentId: student.id, label: `Mensualité ${periodLabel(period)}`, period, dueDate,
            amountCents: plan.amountCents, carriedOverCents: plan.carriedOverCents,
            status: dueDate < today ? "OVERDUE" : "PENDING",
          },
          select: { id: true },
        });
        if (plan.carriedInvoiceIds.length > 0) {
          await tx.invoice.updateMany({ where: { id: { in: plan.carriedInvoiceIds } }, data: { carriedToInvoiceId: invoice.id } });
        }
        result.carriedOverCents += plan.carriedOverCents;
      });
      result.created++;
    } catch (err) {
      // A concurrent run already billed this student for the month (unique studentId + period).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") result.alreadyBilled++;
      else throw err;
    }
  }

  await prisma.invoice.updateMany({
    where: { schoolId, deletedAt: null, carriedToInvoiceId: null, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } },
    data: { status: "OVERDUE" },
  });

  return result;
}
