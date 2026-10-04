import { timingSafeEqual } from "node:crypto";
import { buildActionCards } from "@/core/domain/copilot/rules";
import { loadSnapshot } from "@/infrastructure/copilot/copilot-service";
import { prisma } from "@/infrastructure/db/prisma";
import { container } from "@/presentation/auth/container";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily scan (see vercel.json): records what the copilot found per school in the audit log.
 * No message leaves the server: reminders are one-click links on the dashboard.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("Cron not configured", { status: 503 });
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const schools = await prisma.school.findMany({ where: { deletedAt: null }, select: { id: true } });
  const results = [];
  for (const school of schools) {
    const snapshot = await loadSnapshot({ sessionId: "cron", userId: "cron", schoolId: school.id, role: "SUPER_ADMIN" });
    const cards = buildActionCards(snapshot);
    const summary = {
      arrears: snapshot.arrears.length, upcoming: snapshot.upcoming.length, absentStudents: snapshot.absences.length,
      teachersWithFaults: snapshot.teachers.filter((t) => t.missedRollCalls + t.lateRollCalls + t.missingLogbook > 0).length,
      actions: cards.length,
    };
    await container().audit.record({
      schoolId: school.id, actorId: null, actorRole: null, action: "COPILOT_DAILY_SCAN", resource: "copilot",
      resourceId: null, outcome: "SUCCESS", ip: null, userAgent: "cron", metadata: { ...summary, trigger: "cron" },
    });
    results.push({ schoolId: school.id, ...summary });
  }
  return Response.json({ ok: true, results });
}
