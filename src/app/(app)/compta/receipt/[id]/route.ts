import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { formatMoney } from "@/core/domain/finance/money";
import { prisma } from "@/infrastructure/db/prisma";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { env } from "@/infrastructure/env/env";
import { buildReceiptPdf } from "@/infrastructure/pdf/receipt-pdf";
import { container } from "@/presentation/auth/container";
import { requirePermission } from "@/presentation/auth/guards";

const METHOD_LABELS = { CASH: "Especes", MOBILE_MONEY: "Mobile Money", TRANSFER: "Virement" } as const;

/** `id` is a payment id. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return new Response("Not found", { status: 404 });

  let principal;
  try {
    principal = await requirePermission("finance:read");
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }

  const payment = await tenantPrisma(principal).payment.findFirst({
    where: { id: id.data },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  if (!payment) return new Response("Not found", { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: payment.schoolId }, select: { name: true, currency: true } });
  const pdf = await buildReceiptPdf({
    schoolName: school?.name ?? "",
    studentName: `${payment.student.firstName} ${payment.student.lastName}`,
    label: payment.description,
    amount: formatMoney(payment.amountCents, school?.currency ?? "EUR", "code"),
    method: METHOD_LABELS[payment.method],
    paidAt: payment.paidAt,
    reference: payment.id,
    hash: payment.receiptHash,
    verifyUrl: `${env().APP_URL}/verify/${payment.receiptHash}`,
  });

  await container().audit.record({
    schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
    action: "receipt.download", resource: "payment", resourceId: payment.id, outcome: "SUCCESS",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent"),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recu-${payment.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
