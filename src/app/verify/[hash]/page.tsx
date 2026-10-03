import { notFound } from "next/navigation";
import { formatMoney } from "@/core/domain/finance/money";
import { receiptHash } from "@/core/domain/finance/receipt";
import { prisma } from "@/infrastructure/db/prisma";
import { Badge, Card } from "@/presentation/components/ui";

export const metadata = { title: "Vérification de reçu" };

export default async function VerifyPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) notFound();

  const payment = await prisma.payment.findUnique({
    where: { receiptHash: hash },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
  // Recompute from the stored facts: a tampered row would no longer match its hash.
  const authentic =
    !!payment &&
    receiptHash({
      paymentId: payment.id,
      schoolId: payment.schoolId,
      studentId: payment.studentId,
      amountCents: payment.amountCents,
      paidAt: payment.paidAt,
    }) === hash;

  const school = payment ? await prisma.school.findUnique({ where: { id: payment.schoolId }, select: { name: true, currency: true } }) : null;

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="w-full max-w-md">
        {authentic && payment ? (
          <div className="grid gap-3">
            <Badge tone="success">Reçu authentique</Badge>
            <h1 className="text-2xl font-semibold">{formatMoney(payment.amountCents, school?.currency ?? "EUR")}</h1>
            <p>{payment.description}</p>
            <p className="text-sm text-ink/70">
              {school?.name} · {payment.student.firstName} {payment.student.lastName.charAt(0)}. ·{" "}
              {payment.paidAt.toLocaleDateString("fr-FR")}
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
