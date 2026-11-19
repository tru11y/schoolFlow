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

  const [slots, gradeLevels, shares] = await Promise.all([
    db.timetableSlot.findMany({
      where: { studentId: null, level: { not: null } },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: { teacher: { select: { firstName: true, lastName: true } } },
    }),
    db.gradeLevel.findMany({ orderBy: { position: "asc" }, select: { name: true, position: true } }),
    db.timetableShare.findMany({ where: { revokedAt: null }, select: { level: true, token: true } }),
  ]);

  const order = new Map(gradeLevels.map((g, i) => [g.name, g.position * 1000 + i]));
  const tokenByLevel = new Map(shares.map((s) => [s.level, s.token]));

  const byLevel = new Map<string, GridSlot[]>();
  for (const s of slots) {
    const list = byLevel.get(s.level!) ?? [];
    list.push({
      id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime,
      subject: s.subject, room: s.room, teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
    });
    byLevel.set(s.level!, list);
  }

  const levels: LevelData[] = [...byLevel.entries()]
    .map(([name, slots]) => ({ name, slots, token: tokenByLevel.get(name) ?? null }))
    .sort((a, b) => (order.get(a.name) ?? 1e9) - (order.get(b.name) ?? 1e9));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 print-hide">
        <PageTitle title="Emploi du temps" subtitle="Grille par classe · partage public, export et import Excel/CSV" />
        <ExportButton resource="timetable" label="Modèle / tout exporter (CSV)" />
      </div>

      <Card className="mb-6 print-hide">
        <h2 className="mb-1 text-lg font-semibold">Importer</h2>
        <p className="mb-4 text-sm text-ink/70">
          <strong>Excel (.xlsx)</strong> au format grille, <strong>CSV</strong>, ou un <strong>lien</strong> (fichier direct, OneDrive, Google Sheets) — lu automatiquement.
        </p>
        <ImportTimetable />
      </Card>

      <h2 className="mb-3 text-lg font-semibold print-hide">
        Emploi du temps · {slots.length} créneaux{levels.length ? ` · ${levels.length} classes` : ""}
      </h2>
      <TimetableAdmin levels={levels} />
    </>
  );
}
