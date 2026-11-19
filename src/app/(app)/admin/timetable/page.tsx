import { WEEKDAY_LABELS } from "@/core/domain/timetable/import";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { ExportButton } from "@/presentation/components/export-button";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { ImportTimetable } from "./import-controls";

export default async function TimetableImportPage() {
  const principal = await requirePagePermission("user:manage");
  const db = tenantPrisma(principal);
  const slots = await db.timetableSlot.findMany({
    where: { studentId: null, level: { not: null } },
    orderBy: [{ level: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
    include: { teacher: { select: { firstName: true, lastName: true } } },
  });

  const byLevel = new Map<string, typeof slots>();
  for (const s of slots) byLevel.set(s.level!, [...(byLevel.get(s.level!) ?? []), s]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Emploi du temps" subtitle="Importez l'emploi du temps des classes depuis votre fichier Excel (.xlsx) ou CSV" />
        <ExportButton resource="timetable" label="Télécharger le modèle / l'existant" />
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-semibold">Importer</h2>
        <p className="mb-4 text-sm text-ink/70">
          <strong>Excel (.xlsx)</strong> : déposez directement votre fichier au format grille habituel
          (blocs « EMPLOI DU TEMPS &lt;classe&gt; », jours en colonnes, matière dans chaque case) — il est lu automatiquement.
          <br />
          <strong>CSV</strong> : colonnes <code className="rounded bg-canvas px-1.5 py-0.5">Classe · Jour · Début · Fin · Matière · Enseignant · Salle</code>.
          Jour = Lundi…Dimanche ou 1…7. Heures au format <code className="rounded bg-canvas px-1.5 py-0.5">HH:MM</code>. Enseignant et Salle facultatifs.
        </p>
        <ImportTimetable />
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Emploi du temps actuel · {slots.length} créneaux</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {[...byLevel.entries()].map(([level, list]) => (
          <Card key={level}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{level}</h3>
              <Badge tone="info">{list.length} créneaux</Badge>
            </div>
            <ul className="grid gap-1 text-sm">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2">
                  <span className="w-20 font-medium">{WEEKDAY_LABELS[s.weekday - 1]}</span>
                  <span className="tabular-nums text-ink/70">{s.startTime}–{s.endTime}</span>
                  <span>{s.subject}</span>
                  {s.teacher ? <span className="text-xs text-ink/60">· {s.teacher.firstName} {s.teacher.lastName}</span> : null}
                  {s.room ? <span className="text-xs text-ink/60">· {s.room}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {byLevel.size === 0 ? <Card><p className="text-ink/70">Aucun créneau de classe pour le moment. Importez votre fichier ci-dessus.</p></Card> : null}
      </div>
    </>
  );
}
