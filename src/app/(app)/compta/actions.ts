"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { receiptHash } from "@/core/domain/finance/receipt";
import { secureAction } from "@/presentation/secure-action";

export const markInvoicePaid = secureAction(
  {
    name: "invoice.pay",
    resource: "invoice",
    permission: "finance:write",
    input: z.object({ invoiceId: z.string().uuid() }),
    resourceId: (input) => input.invoiceId,
  },
  async ({ input, db }) => {
    const invoice = await db.invoice.findFirst({ where: { id: input.invoiceId, status: "PENDING", deletedAt: null } });
    if (!invoice) throw new ForbiddenError("invoice:not-payable");

    const paidAt = new Date();
    const hash = receiptHash({
      invoiceId: invoice.id,
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      amountCents: invoice.amountCents,
      paidAt,
    });
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt, receiptHash: hash } });
    revalidatePath("/compta");
    return { receiptHash: hash };
  },
);
