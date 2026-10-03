"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { allocatePayment, remaining, statusAfterPayment, type Allocation } from "@/core/domain/finance/billing";
import { toMinorUnits } from "@/core/domain/finance/money";
import { receiptHash } from "@/core/domain/finance/receipt";
import { generateMonthlyInvoices, type GenerationResult } from "@/infrastructure/billing/monthly-invoices";
import { prisma } from "@/infrastructure/db/prisma";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../students/schemas";
import { localParts } from "@/core/domain/attendance/policy";

export type PaymentResult =
  | { status: "ok"; paymentId: string; amountCents: number; allocations: Allocation[] }
  | { status: "nothing_due" }
  | { status: "overpay"; outstandingCents: number };

export const recordPayment = secureAction(
  {
    name: "PAYMENT_RECORDED",
    resource: "payment",
    permission: "finance:write",
    input: z.object({
      studentId: z.string().uuid(),
      amount: z.coerce.number().positive().max(1_000_000_000),
      method: z.enum(["CASH", "MOBILE_MONEY", "TRANSFER"]),
      description: text(160),
    }),
    resourceId: (_i, data: PaymentResult) => (data.status === "ok" ? data.paymentId : null),
    // Ids, method and amounts only: no free text.
    auditMetadata: (i, data: PaymentResult | undefined) => ({
      studentId: i.studentId,
      method: i.method,
      ...(data?.status === "ok" ? { amountCents: data.amountCents, allocations: data.allocations } : { outcome: data?.status }),
    }),
  },
  async ({ input, db, principal }): Promise<PaymentResult> => {
    const student = await db.user.findFirst({
      where: { id: input.studentId, role: "STUDENT", deletedAt: null },
      select: { id: true, schoolId: true },
    });
    if (!student?.schoolId) throw new ForbiddenError("student:not-found");
    const { schoolId } = student;

    const currency = await getSchoolCurrency(schoolId);
    const amountCents = toMinorUnits(input.amount, currency);
    const now = new Date();
    const today = new Date(localParts(now).date);

    // Balances never count invoices already folded into a newer one.
    const invoices = await db.invoice.findMany({
      where: { studentId: student.id, deletedAt: null, carriedToInvoiceId: null },
      select: { id: true, amountCents: true, paidCents: true, dueDate: true },
    });
    const open = invoices
      .filter((i) => remaining(i) > 0)
      .map((i) => ({ id: i.id, dueDate: i.dueDate, remainingCents: remaining(i) }));
    if (open.length === 0) return { status: "nothing_due" };

    const { allocations, leftoverCents } = allocatePayment(open, amountCents);
    if (leftoverCents > 0) {
      return { status: "overpay", outstandingCents: open.reduce((sum, i) => sum + i.remainingCents, 0) };
    }

    const paymentId = randomUUID();
    const byId = new Map(invoices.map((i) => [i.id, i]));
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          id: paymentId, schoolId, studentId: student.id, amountCents, method: input.method,
          description: input.description, paidAt: now, recordedById: principal.userId, allocations,
          receiptHash: receiptHash({ paymentId, schoolId, studentId: student.id, amountCents, paidAt: now }),
        },
      }),
      ...allocations.map((a) => {
        const inv = byId.get(a.invoiceId)!;
        const paidCents = inv.paidCents + a.amountCents;
        const status = statusAfterPayment({ amountCents: inv.amountCents, paidCents, dueDate: inv.dueDate }, today);
        return prisma.invoice.update({
          where: { id: inv.id },
          data: { paidCents, status, paidAt: status === "PAID" ? now : null },
        });
      }),
    ]);

    revalidatePath("/compta");
    revalidatePath("/dashboard");
    revalidatePath(`/students/${student.id}`);
    return { status: "ok", paymentId, amountCents, allocations };
  },
);

export const generateInvoices = secureAction(
  {
    name: "INVOICES_GENERATED",
    resource: "invoice",
    permission: "finance:write",
    input: z.object({}),
    auditMetadata: (_i, data: GenerationResult | undefined) => ({ ...data, trigger: "manual" }),
  },
  async ({ principal }): Promise<GenerationResult> => {
    if (!principal.schoolId) throw new ForbiddenError("tenant:missing");
    const result = await generateMonthlyInvoices(principal.schoolId);
    revalidatePath("/compta");
    revalidatePath("/dashboard");
    return result;
  },
);
