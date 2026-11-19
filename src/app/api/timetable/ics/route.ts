import { buildIcs, weekMonday } from "@/core/domain/timetable/ics";
import { ForbiddenError } from "@/core/domain/errors";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePermission } from "@/presentation/auth/guards";
import type { Principal } from "@/core/domain/auth/principal";

export async function GET(req: Request) {
  const level = new URL(req.url).searchParams.get("level");
  if (!level) return new Response("level requis", { status: 400 });

  let principal: Principal;
  try {
    principal = await requirePermission("user:manage");
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }
  const db = tenantPrisma(principal);
  const slots = await db.timetableSlot.findMany({
    where: { studentId: null, level },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const ics = buildIcs({
    calendarName: `Emploi du temps ${level}`,
    anchorMonday: weekMonday(new Date()),
    slots: slots.map((s) => ({
      id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime,
      subject: s.subject, room: s.room, teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
    })),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="emploi-du-temps-${level}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
