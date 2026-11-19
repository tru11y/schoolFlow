import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { ExportButton } from "@/presentation/components/export-button";
import { Card, PageTitle } from "@/presentation/components/ui";
import type { GridSlot } from "@/presentation/components/timetable-grid";
import { ImportTimetable } from "./import-controls";
import { TimetableAdmin, type LevelData } from "./admin-timetable";

export default async function TimetableImportPage() {
  const principal = await requirePagePermission("user:manage");
  const db = tenantPrisma(principal);

  const [slots, gradeLevels, shares, teachers] = await Promise.all([
    db.timetableSlot.findMany({
      where: { studentId: null, level: { not: null } },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: { teacher: { select: { firstName: true, lastName: true } } },
    }),
    db.gradeLevel.findMany({ orderBy: { position: "asc" }, select: { name: true, position: true } }),
    db.timetableShare.findMany({ where: { revokedAt: null }, select: { level: true, token: true } }),
    db.user.findMany({
      where: { role: "TEACHER", deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const order = new Map(gradeLevels.map((g, i) => [g.name, g.position * 1000 + i]));
  const tokenByLevel = new Map(shares.map((s) => [s.level, s.token]));

  const byLevel = new Map<string, GridSlot[]>();
  for (const s of slots) {
    const list = byLevel.get(s.level!) ?? [];
    list.push({
      id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime,
      subject: s.subject, room: s.room, teacherId: s.teacherId,
      teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
    });
    byLevel.set(s.level!, list);
  }

  const levels: LevelData[] = [...byLevel.entries()]
    .map(([name, slots]) => ({ name, slots, token: tokenByLevel.get(name) ?? null }))
    .sort((a, b) => (order.get(a.name) ?? 1e9) - (order.get(b.name) ?? 1e9));
  // Every registered class level, even those with no slot yet, so one can be filled from scratch.
  const allLevels = gradeLevels.map((g) => g.name);
  const teacherOptions = teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 print-hide">
        <PageTitle
          title="Emploi du temps"
          subtitle={`${slots.length} créneaux${levels.length ? ` · ${levels.length} classes` : ""} · partage et export par classe`}
        />
        <ExportButton resource="timetable" label="Tout exporter (CSV)" />
      </div>

      <TimetableAdmin levels={levels} allLevels={allLevels} teachers={teacherOptions} />

      <details className="group mt-8 print-hide">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm font-medium shadow-soft ring-1 ring-ink/10 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent">
          <span aria-hidden className="transition group-open:rotate-90">▸</span>
          Importer un emploi du temps (Excel .xlsx, CSV ou lien)
        </summary>
        <Card className="mt-3">
          <p className="mb-4 text-sm text-ink/70">
            <strong>Excel (.xlsx)</strong> au format grille, <strong>CSV</strong>, ou un <strong>lien</strong> (fichier direct, OneDrive, Google Sheets) — lu automatiquement.
          </p>
          <ImportTimetable />
        </Card>
      </details>
    </>
  );
}
