import { z } from "zod";
import { ForbiddenError } from "@/core/domain/errors";
import { formatEuros } from "@/core/domain/finance/receipt";
import { prisma } from "@/infrastructure/db/prisma";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { env } from "@/infrastructure/env/env";
import { buildReceiptPdf } from "@/infrastructure/pdf/receipt-pdf";
import { container } from "@/presentation/auth/container";
import { requirePermission } from "@/presentation/auth/guards";

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

  const invoice = await tenantPrisma(principal).invoice.findFirst({
    where: { id: id.data, status: "PAID", deletedAt: null },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  if (!invoice?.receiptHash || !invoice.paidAt) return new Response("Not found", { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: invoice.schoolId }, select: { name: true } });
  const pdf = await buildReceiptPdf({
    schoolName: school?.name ?? "",
    studentName: `${invoice.student.firstName} ${invoice.student.lastName}`,
    label: invoice.label,
    amount: formatEuros(invoice.amountCents),
    paidAt: invoice.paidAt,
    invoiceId: invoice.id,
    hash: invoice.receiptHash,
    verifyUrl: `${env().APP_URL}/verify/${invoice.receiptHash}`,
  });

  await container().audit.record({
    schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
    action: "receipt.download", resource: "invoice", resourceId: invoice.id, outcome: "SUCCESS",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent"),
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recu-${invoice.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
