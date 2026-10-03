import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { canWriteScope, dayLabel, timeRange } from "@/core/domain/logbook/logbook";
import { can } from "@/core/domain/rbac/role";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { LogbookForm, type LogbookInitial } from "./logbook-form";
import { loadReadableLevels, loadWriteScopes } from "./scopes";

interface SearchParams {
  level?: string;
  subject?: string;
  new?: string;
  edit?: string;
  slot?: string;
  date?: string;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

export default async function LogbookPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const principal = await requirePagePermission("homework:read");
  const q = await searchParams;
  const db = tenantPrisma(principal);
  const canWrite = can(principal.role, "homework:write");
  const today = localParts(new Date()).date;

  const allLevels = (await listLevels(db)).map((l) => l.name);
  const readable = await loadReadableLevels(db, principal, allLevels);
  const level = readable.includes(q.level ?? "") ? q.level : readable.length === 1 ? readable[0] : undefined;

  const where = { level: level ?? { in: readable }, ...(q.subject ? { subject: q.subject } : {}) };
  const [entries, subjectRows] = await Promise.all([
    db.logbookEntry.findMany({
      where,
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 80,
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        chapter: { select: { position: true, title: true } },
      },
    }),
    db.logbookEntry.findMany({ where: { level: level ?? { in: readable } }, distinct: ["subject"], select: { subject: true }, orderBy: { subject: "asc" } }),
  ]);

  // Composer data (teachers: only their scopes; admins: everything configured)
  let composer: React.ReactNode = null;
  if (canWrite) {
    const { all, scopes } = await loadWriteScopes(db, principal);
    const [slots, chapters] = await Promise.all([
      db.timetableSlot.findMany({
        where: { level: { not: null }, ...(all ? {} : { teacherId: principal.userId }) },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        select: { id: true, level: true, subject: true, weekday: true, startTime: true, endTime: true },
      }),
      db.curriculumChapter.findMany({ orderBy: [{ subject: "asc" }, { position: "asc" }] }),
    ]);

    const subjectsByLevel: Record<string, string[]> = {};
    const add = (l: string, s: string) => {
      subjectsByLevel[l] = [...new Set([...(subjectsByLevel[l] ?? []), s])].sort();
    };
    if (all) {
      for (const s of slots) if (s.level) add(s.level, s.subject);
      for (const c of chapters) add(c.level, c.subject);
    } else {
      for (const s of scopes) add(s.level, s.subject);
    }
    const levels = allLevels.filter((l) => (subjectsByLevel[l]?.length ?? 0) > 0);

    let initial: LogbookInitial | undefined;
    if (q.edit) {
      const e = await db.logbookEntry.findFirst({ where: { id: q.edit } });
      if (e && (all || e.teacherId === principal.userId)) {
        initial = {
          id: e.id, level: e.level, subject: e.subject, date: iso(e.date), slotId: e.slotId ?? undefined,
          startTime: e.startTime ?? undefined, endTime: e.endTime ?? undefined, title: e.title, content: e.content,
          homework: e.homework ?? undefined, homeworkDue: iso(e.homeworkDue), chapterId: e.chapterId ?? undefined,
        };
      }
    } else if (q.new && q.level && q.subject && (all ? levels.includes(q.level) : canWriteScope(scopes, q.level, q.subject))) {
      const slot = slots.find((s) => s.id === q.slot && s.level === q.level && s.subject === q.subject);
      initial = {
        level: q.level, subject: q.subject, date: /^\d{4}-\d{2}-\d{2}$/.test(q.date ?? "") ? q.date : today,
        slotId: slot?.id, startTime: slot?.startTime, endTime: slot?.endTime,
      };
    }

    composer = (
      <LogbookForm
        key={initial ? `${initial.id ?? "new"}-${initial.slotId ?? ""}-${initial.level}` : "plain"}
        levels={levels}
        subjectsByLevel={subjectsByLevel}
        slots={slots.flatMap((s) => (s.level ? [{ ...s, level: s.level }] : []))}
        chapters={chapters.map((c) => ({ id: c.id, level: c.level, subject: c.subject, label: `${c.subject} - Ch. ${c.position} : ${c.title}` }))}
        today={today}
        initial={initial}
        autoOpen={!!initial}
      />
    );
  }

  const chip = (active: boolean) =>
    `min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
      active ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
    }`;
  const href = (l?: string, subject?: string) => {
    const p = new URLSearchParams({ ...(l ? { level: l } : {}), ...(subject ? { subject } : {}) });
    return `/cahier-de-texte${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Cahier de texte" subtitle="Le déroulé des cours et les devoirs, classe par classe" />
        {composer}
      </div>

      {readable.length > 1 ? (
        <nav aria-label="Classe" className="mb-3 flex gap-2 overflow-x-auto pb-1">
          <Link href={href()} aria-current={!level ? "page" : undefined} className={chip(!level)}>Toutes</Link>
          {readable.map((l) => (
            <Link key={l} href={href(l)} aria-current={level === l ? "page" : undefined} className={chip(level === l)}>{l}</Link>
          ))}
        </nav>
      ) : null}
      {subjectRows.length > 1 ? (
        <nav aria-label="Matière" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <Link href={href(level)} aria-current={!q.subject ? "page" : undefined} className={chip(!q.subject)}>Toutes matières</Link>
          {subjectRows.map((s) => (
            <Link key={s.subject} href={href(level, s.subject)} aria-current={q.subject === s.subject ? "page" : undefined} className={chip(q.subject === s.subject)}>
              {s.subject}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="grid gap-4">
        {entries.map((e) => {
          const when = iso(e.date)!;
          const times = timeRange(e.startTime, e.endTime);
          const mine = principal.role !== "TEACHER" || e.teacherId === principal.userId;
          return (
            <article key={e.id} className="rounded-3xl bg-surface p-6 shadow-soft">
              <header className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{dayLabel(when, today)}{times ? ` ${times}` : ""} • {e.subject}</Badge>
                <Badge tone="warning">{e.level}</Badge>
                {e.chapter ? <Badge tone="success">Ch. {e.chapter.position} · {e.chapter.title}</Badge> : null}
                {canWrite && mine ? (
                  <Link href={`/cahier-de-texte?edit=${e.id}`} className="ml-auto rounded-xl px-3 py-1 text-sm text-ink/70 hover:bg-raised">Modifier</Link>
                ) : null}
              </header>
              <h2 className="mt-3 text-lg font-semibold">{e.title}</h2>
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink/90">{e.content}</p>
              {e.homework ? (
                <div className="mt-4 rounded-2xl bg-peach/10 p-4 ring-1 ring-peach/20">
                  <p className="text-sm font-medium text-peach">
                    Devoirs à faire{e.homeworkDue ? ` · pour le ${e.homeworkDue.toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{e.homework}</p>
                </div>
              ) : null}
              <p className="mt-4 text-xs text-ink/70">{e.teacher.firstName} {e.teacher.lastName}</p>
            </article>
          );
        })}
        {entries.length === 0 ? (
          <Card><p className="text-ink/70">Aucune séance renseignée pour le moment.</p></Card>
        ) : null}
      </div>
    </>
  );
}
