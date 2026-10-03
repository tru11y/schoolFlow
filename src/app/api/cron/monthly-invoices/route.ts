import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { generateMonthlyInvoices } from "@/infrastructure/billing/monthly-invoices";
import { container } from "@/presentation/auth/container";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Monthly job (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("Cron not configured", { status: 503 });
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const schools = await prisma.school.findMany({ where: { deletedAt: null }, select: { id: true } });
  const results = [];
  for (const school of schools) {
    const result = await generateMonthlyInvoices(school.id);
    await container().audit.record({
      schoolId: school.id, actorId: null, actorRole: null, action: "INVOICES_GENERATED", resource: "invoice",
      resourceId: null, outcome: "SUCCESS", ip: null, userAgent: "cron", metadata: { ...result, trigger: "cron" },
    });
    results.push({ schoolId: school.id, ...result });
  }
  return Response.json({ ok: true, results });
}
