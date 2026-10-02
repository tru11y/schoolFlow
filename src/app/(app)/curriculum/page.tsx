import { can } from "@/core/domain/rbac/role";
import Link from "next/link";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { AddChapter, ChapterCheck } from "./chapter-controls";

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const principal = await requirePagePermission("homework:read");
  const canWrite = can(principal.role, "homework:write");
  const db = tenantPrisma(principal);
  const levels = await listLevels(db);
  const { level: rawLevel } = await searchParams;
  const level = levels.find((l) => l.name === rawLevel)?.name;
  const chapters = await db.curriculumChapter.findMany({
    where: level ? { level } : {},
    orderBy: [{ level: "asc" }, { subject: "asc" }, { position: "asc" }],
  });

  const groups = new Map<string, typeof chapters>();
  for (const c of chapters) groups.set(`${c.level}|${c.subject}`, [...(groups.get(`${c.level}|${c.subject}`) ?? []), c]);
  const subjects = [...new Set(chapters.map((c) => c.subject))];

  return (
    <>
      <PageTitle title="Programmes pédagogiques" subtitle="Chapitres du programme de renforcement, cochés au fil des séances" />
      {canWrite ? (
        <Card className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Ajouter un chapitre</h2>
          <AddChapter subjects={subjects} levels={levels.map((l) => l.name)} />
        </Card>
      ) : null}

      <nav aria-label="Filtrer par niveau" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", name: "" }, ...levels].map((l) => (
          <Link
            key={l.id}
            href={l.name ? `/curriculum?level=${encodeURIComponent(l.name)}` : "/curriculum"}
            aria-current={(level ?? "") === l.name ? "page" : undefined}
            className={`min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
              (level ?? "") === l.name ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
            }`}
          >
            {l.name || "Tous"}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-2">
        {[...groups.entries()].map(([key, list]) => {
          const [level, subject] = key.split("|");
          const done = list.filter((c) => c.completedAt).length;
          const pct = Math.round((done / list.length) * 100);
          const next = list.find((c) => !c.completedAt);
          return (
            <Card key={key}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{subject} · {level}</h2>
                <Badge tone={pct === 100 ? "success" : "info"}>{done}/{list.length} · {pct} %</Badge>
              </div>
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avancement ${subject} ${level}`} className="mb-3 h-2 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${pct}%` }} />
              </div>
              <ul className="grid gap-1">
                {list.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <ChapterCheck id={c.id} title={c.title} position={c.position} done={!!c.completedAt} canWrite={canWrite} />
                    </div>
                    {next?.id === c.id ? <Badge tone="warning">En cours</Badge> : null}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        {groups.size === 0 ? <Card><p className="text-ink/70">Aucun chapitre pour le moment.</p></Card> : null}
      </div>
    </>
  );
}
