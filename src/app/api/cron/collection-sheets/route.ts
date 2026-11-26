import { timingSafeEqual } from "node:crypto";
import { localParts } from "@/core/domain/attendance/policy";
import { periodLabel, periodOf } from "@/core/domain/finance/billing";
import { toCsv } from "@/core/domain/export/csv";
import { prisma } from "@/infrastructure/db/prisma";
import { generateMonthlyInvoices } from "@/infrastructure/billing/monthly-invoices";
import { buildCollectionSheet } from "@/infrastructure/billing/collection-sheet";
import { sendEmail } from "@/infrastructure/email/mailer";
import { container } from "@/presentation/auth/container";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** True when `now` is the last day of its month (local time). */
function isLastDayOfMonth(now: Date): boolean {
  const tomorrow = new Date(now.getTime() + 86_400_000);
  return periodOf(localParts(now).date) !== periodOf(localParts(tomorrow).date);
}

/**
 * End-of-month job (see vercel.json, runs daily on 28-31). Freezes each school's collection sheet for the
 * current month and e-mails it to the school's admins when email is configured. `?force=1` bypasses the
 * last-day guard for manual runs. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("Cron not configured", { status: 503 });
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const now = new Date();
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!isLastDayOfMonth(now) && !force) return Response.json({ ok: true, skipped: "not-last-day" });

  const period = periodOf(localParts(now).date);
  const schools = await prisma.school.findMany({ where: { deletedAt: null }, select: { id: true } });
  const results = [];

  for (const school of schools) {
    // Make sure this month's invoices exist so the snapshot reflects real amounts due.
    await generateMonthlyInvoices(school.id, now);

    const sheet = await buildCollectionSheet(school.id, period);
    const csv = toCsv(sheet.headers, sheet.rows);

    await prisma.collectionSheet.upsert({
      where: { schoolId_period: { schoolId: school.id, period } },
      create: {
        schoolId: school.id, period, csv, rowCount: sheet.rowCount,
        totalDueCents: sheet.totalDueCents, totalPaidCents: sheet.totalPaidCents, totalRemainingCents: sheet.totalRemainingCents,
      },
      update: {
        csv, rowCount: sheet.rowCount, generatedAt: now,
        totalDueCents: sheet.totalDueCents, totalPaidCents: sheet.totalPaidCents, totalRemainingCents: sheet.totalRemainingCents,
      },
    });

    const admins = await prisma.user.findMany({
      where: { schoolId: school.id, role: "SCHOOL_ADMIN", deletedAt: null, isActive: true },
      select: { email: true },
    });
    let email: "sent" | "skipped" | "error" = "skipped";
    try {
      email = await sendEmail({
        to: admins.map((a) => a.email),
        subject: `Feuille d'encaissement — ${periodLabel(period)}`,
        text: `La feuille d'encaissement de ${periodLabel(period)} est en pièce jointe.\n${sheet.rowCount} élève(s).`,
        attachments: [{ filename: `encaissement-${period}.csv`, content: csv }],
      });
    } catch {
      email = "error";
    }

    await container().audit.record({
      schoolId: school.id, actorId: null, actorRole: null, action: "collection_sheet.generated", resource: "collection_sheet",
      resourceId: period, outcome: "SUCCESS", ip: null, userAgent: "cron",
      metadata: { period, rowCount: sheet.rowCount, totalRemainingCents: sheet.totalRemainingCents, email },
    });
    results.push({ schoolId: school.id, period, rowCount: sheet.rowCount, email });
  }

  return Response.json({ ok: true, period, results });
}
