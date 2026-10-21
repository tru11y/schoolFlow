"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import {
  allocatePayment, applyAllocations, openInvoicesOf, remaining, reverseAllocations, statusAfterPayment,
  type Allocation, type InvoiceState,
} from "@/core/domain/finance/billing";
import { toMinorUnits } from "@/core/domain/finance/money";
import { receiptHash } from "@/core/domain/finance/receipt";
import { generateMonthlyInvoices, type GenerationResult } from "@/infrastructure/billing/monthly-invoices";
import { prisma } from "@/infrastructure/db/prisma";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { secureAction } from "@/presentation/secure-action";
import { text } from "../students/schemas";
import { localParts } from "@/core/domain/attendance/policy";

export type PaymentResult =
  | { status: "ok"; paymentId: string; amountCents: number; allocations: Allocation[] }
  | { status: "nothing_due" }
  | { status: "overpay"; outstandingCents: number };

const METHODS = ["CASH", "MOBILE_MONEY", "TRANSFER", "CHEQUE"] as const;
const reference = z.string().trim().max(80).optional().transform((v) => v || null);

export const recordPayment = secureAction(
  {
    name: "PAYMENT_RECORDED",
    resource: "payment",
    permission: "finance:write",
    input: z.object({
      studentId: z.string().uuid(),
      amount: z.coerce.number().positive().max(1_000_000_000),
      method: z.enum(METHODS),
      description: text(160),
      reference: reference,
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
          description: input.description, reference: input.reference, paidAt: now, recordedById: principal.userId, allocations,
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

export type PaymentChangeResult =
  | { status: "ok"; paymentId: string; studentId: string; amountCents: number; actor: { name: string; email: string } }
  | { status: "not_found" }
  | { status: "overpay"; outstandingCents: number };

/**
 * Reverses the payment on its invoices, optionally re-applies a new amount, and persists everything in one transaction.
 * `amountCents: null` cancels the payment.
 */
async function rebalance(
  db: ReturnType<typeof tenantPrisma>,
  payment: { id: string; studentId: string; allocations: unknown },
  amountCents: number | null,
): Promise<{ allocations: Allocation[]; patches: ReturnType<typeof prisma.invoice.update>[] } | { overpay: number }> {
  const rows = await db.invoice.findMany({
    where: { studentId: payment.studentId, deletedAt: null },
    select: { id: true, amountCents: true, paidCents: true, dueDate: true, carriedOverCents: true, carriedToInvoiceId: true, paidAt: true },
  });
  const before: InvoiceState[] = rows;
  let after = reverseAllocations(before, payment.allocations as Allocation[]);
  let allocations: Allocation[] = [];
  if (amountCents !== null) {
    const open = openInvoicesOf(after);
    const plan = allocatePayment(open, amountCents);
    if (plan.leftoverCents > 0) return { overpay: open.reduce((sum, i) => sum + i.remainingCents, 0) };
    allocations = plan.allocations;
    after = applyAllocations(after, allocations);
  }

  const now = new Date();
  const today = new Date(localParts(now).date);
  const paidAtById = new Map(rows.map((r) => [r.id, r.paidAt]));
  const prev = new Map(before.map((i) => [i.id, i]));
  const patches = after
    .filter((i) => {
      const p = prev.get(i.id)!;
      return p.paidCents !== i.paidCents || p.amountCents !== i.amountCents;
    })
    .map((i) => {
      const status = statusAfterPayment(i, today);
      return prisma.invoice.update({
        where: { id: i.id },
        data: {
          paidCents: i.paidCents,
          amountCents: i.amountCents,
          carriedOverCents: i.carriedOverCents,
          status,
          paidAt: status === "PAID" ? (paidAtById.get(i.id) ?? now) : null,
        },
      });
    });
  return { allocations, patches };
}

const revalidatePayments = (studentId: string) => {
  revalidatePath("/compta");
  revalidatePath("/dashboard");
  revalidatePath(`/students/${studentId}`);
};

const loadActor = async (userId: string) => {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, email: true } });
  return { name: u ? `${u.firstName} ${u.lastName}` : "?", email: u?.email ?? "?" };
};

export const updatePayment = secureAction(
  {
    name: "PAYMENT_UPDATED",
    resource: "payment",
    permission: "payment:manage",
    input: z.object({
      paymentId: z.string().uuid(),
      amount: z.coerce.number().positive().max(1_000_000_000),
      method: z.enum(METHODS),
      description: text(160),
      paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reference,
      reason: text(200),
    }),
    resourceId: (i) => i.paymentId,
    auditMetadata: (i, data: PaymentChangeResult | undefined) => ({
      method: i.method, reference: i.reference, reason: i.reason,
      ...(data?.status === "ok" ? { amountCents: data.amountCents, actor: data.actor } : { outcome: data?.status }),
    }),
  },
  async ({ input, db, principal }): Promise<PaymentChangeResult> => {
    const payment = await db.payment.findFirst({ where: { id: input.paymentId, deletedAt: null } });
    if (!payment) return { status: "not_found" };

    const currency = await getSchoolCurrency(payment.schoolId);
    const amountCents = toMinorUnits(input.amount, currency);
    // A date left untouched keeps the original timestamp so the certified facts do not drift.
    const paidAt = payment.paidAt.toISOString().slice(0, 10) === input.paidAt ? payment.paidAt : new Date(`${input.paidAt}T12:00:00.000Z`);

    const plan = await rebalance(db, payment, amountCents);
    if ("overpay" in plan) return { status: "overpay", outstandingCents: plan.overpay };

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          amountCents, method: input.method, description: input.description, reference: input.reference, paidAt,
          allocations: plan.allocations,
          receiptHash: receiptHash({ paymentId: payment.id, schoolId: payment.schoolId, studentId: payment.studentId, amountCents, paidAt }),
        },
      }),
      ...plan.patches,
    ]);

    revalidatePayments(payment.studentId);
    return { status: "ok", paymentId: payment.id, studentId: payment.studentId, amountCents, actor: await loadActor(principal.userId) };
  },
);

export const deletePayment = secureAction(
  {
    name: "PAYMENT_DELETED",
    resource: "payment",
    permission: "payment:manage",
    input: z.object({ paymentId: z.string().uuid(), reason: text(200) }),
    resourceId: (i) => i.paymentId,
    auditMetadata: (i, data: PaymentChangeResult | undefined) => ({
      reason: i.reason,
      ...(data?.status === "ok" ? { amountCents: data.amountCents, actor: data.actor } : { outcome: data?.status }),
    }),
    auditSeverity: () => "WARNING",
  },
  async ({ input, db, principal }): Promise<PaymentChangeResult> => {
    const payment = await db.payment.findFirst({ where: { id: input.paymentId, deletedAt: null } });
    if (!payment) return { status: "not_found" };

    const plan = await rebalance(db, payment, null);
    if ("overpay" in plan) return { status: "overpay", outstandingCents: plan.overpay };

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { deletedAt: new Date(), deletedById: principal.userId, deleteReason: input.reason },
      }),
      ...plan.patches,
    ]);

    revalidatePayments(payment.studentId);
    return { status: "ok", paymentId: payment.id, studentId: payment.studentId, amountCents: payment.amountCents, actor: await loadActor(principal.userId) };
  },
);
