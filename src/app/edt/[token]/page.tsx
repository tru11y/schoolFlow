import { notFound } from "next/navigation";
import { SHARE_TOKEN_RE } from "@/core/domain/timetable/share";
import { prisma } from "@/infrastructure/db/prisma";
import { Card } from "@/presentation/components/ui";
import { SubjectLegend, TimetableGrid } from "@/presentation/components/timetable-grid";
import { TimetableExportActions } from "@/presentation/components/timetable-export-actions";

export const metadata = { title: "Emploi du temps" };

export default async function SharedTimetablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!SHARE_TOKEN_RE.test(token)) notFound();

  const share = await prisma.timetableShare.findUnique({ where: { token } });
  if (!share || share.revokedAt) notFound();

  const [school, slots] = await Promise.all([
    prisma.school.findUnique({ where: { id: share.schoolId }, select: { name: true } }),
    prisma.timetableSlot.findMany({
      where: { schoolId: share.schoolId, studentId: null, level: share.level },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: { teacher: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const grid = slots.map((s) => ({
    id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime,
    subject: s.subject, room: s.room, teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
  }));
  const subjects = [...new Set(grid.map((s) => s.subject))].sort();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink/50">{school?.name ?? "École"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Emploi du temps · {share.level}</h1>
        </div>
        <TimetableExportActions captureId="edt-capture" fileBase={`emploi-du-temps-${share.level}`} icsHref={`/api/edt/${token}/ics`} />
      </header>

      {subjects.length ? <div className="mb-5"><SubjectLegend subjects={subjects} /></div> : null}

      <Card id="edt-capture" className="p-4 sm:p-6">
        {grid.length ? (
          <TimetableGrid slots={grid} />
        ) : (
          <p className="py-10 text-center text-ink/60">Aucun créneau pour cette classe.</p>
        )}
      </Card>

      <p className="mt-6 text-center text-xs text-ink/40">Lien partagé en lecture seule · {share.level}</p>
    </main>
  );
}
