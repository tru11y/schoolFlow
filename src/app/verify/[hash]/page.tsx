import { notFound } from "next/navigation";
import { formatMoney } from "@/core/domain/finance/money";
import { receiptHash } from "@/core/domain/finance/receipt";
import { prisma } from "@/infrastructure/db/prisma";
import { Badge, Card } from "@/presentation/components/ui";

export const metadata = { title: "Vérification de reçu" };

export default async function VerifyPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { receiptHash: hash },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  const authentic =
    !!invoice?.paidAt &&
    receiptHash({
      invoiceId: invoice.id,
      schoolId: invoice.schoolId,
      studentId: invoice.studentId,
      amountCents: invoice.amountCents,
      paidAt: invoice.paidAt,
    }) === hash;

  const school = invoice ? await prisma.school.findUnique({ where: { id: invoice.schoolId }, select: { name: true, currency: true } }) : null;

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-md">
        {authentic && invoice?.paidAt ? (
          <div className="grid gap-3">
            <Badge tone="success">Reçu authentique</Badge>
            <h1 className="text-2xl font-semibold">{formatMoney(invoice.amountCents, school?.currency ?? "EUR")}</h1>
            <p>{invoice.label}</p>
            <p className="text-sm text-ink/70">
              {school?.name} · {invoice.student.firstName} {invoice.student.lastName.charAt(0)}. ·{" "}
              {invoice.paidAt.toLocaleDateString("fr-FR")}
            </p>
            <p className="break-all font-mono text-xs text-ink/70">SHA-256 {hash}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <Badge tone="danger">Reçu introuvable ou invalide</Badge>
            <p className="text-sm text-ink/70">Cette empreinte ne correspond à aucun reçu émis par SchoolFlow.</p>
          </div>
        )}
      </Card>
    </main>
  );
}
