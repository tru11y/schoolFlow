import { buildIcs, weekMonday } from "@/core/domain/timetable/ics";
import { SHARE_TOKEN_RE } from "@/core/domain/timetable/share";
import { prisma } from "@/infrastructure/db/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!SHARE_TOKEN_RE.test(token)) return new Response("Not found", { status: 404 });

  const share = await prisma.timetableShare.findUnique({ where: { token } });
  if (!share || share.revokedAt) return new Response("Not found", { status: 404 });

  const slots = await prisma.timetableSlot.findMany({
    where: { schoolId: share.schoolId, studentId: null, level: share.level },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const ics = buildIcs({
    calendarName: `Emploi du temps ${share.level}`,
    anchorMonday: weekMonday(new Date()),
    slots: slots.map((s) => ({
      id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime,
      subject: s.subject, room: s.room, teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
    })),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="emploi-du-temps-${share.level}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
