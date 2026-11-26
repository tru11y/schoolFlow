import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { can } from "@/core/domain/rbac/role";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { DeleteButton } from "@/presentation/components/delete-button";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { ExportButton } from "@/presentation/components/export-button";
import { deleteAttendanceSession } from "./actions";

const LABELS = { PRESENT: "Présent", ABSENT: "Absent", LATE: "Retard" } as const;
const TONES = { PRESENT: "success", ABSENT: "danger", LATE: "warning" } as const;

const isDate = (v: string | undefined): v is string => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<{ level?: string; from?: string; to?: string }> }) {
  const principal = await requirePagePermission("attendance:read");
  const db = tenantPrisma(principal);

  const canDelete = can(principal.role, "user:manage");
  if (can(principal.role, "attendance:write")) {
    const levels = await listLevels(db);
    const { level: rawLevel, from: rawFrom, to: rawTo } = await searchParams;
    const level = levels.find((l) => l.name === rawLevel)?.name;
    const today = localParts(new Date()).date;
    let from = isDate(rawFrom) ? rawFrom : today;
    let to = isDate(rawTo) ? rawTo : today;
    if (from > to) [from, to] = [to, from];
    const isToday = from === today && to === today;
    const isRange = from !== to;
    const shift = (days: number) => localParts(new Date(Date.now() - days * 86_400_000)).date;
    const monthStart = `${today.slice(0, 7)}-01`;
    const presets: { label: string; from: string; to: string }[] = [
      { label: "Aujourd'hui", from: today, to: today },
      { label: "7 derniers jours", from: shift(6), to: today },
      { label: "30 derniers jours", from: shift(29), to: today },
      { label: "Ce mois-ci", from: monthStart, to: today },
    ];
    const ownOnly = principal.role === "TEACHER";
    const sessions = await db.attendanceSession.findMany({
      where: {
        deletedAt: null,
        date: { gte: new Date(from), lte: new Date(to) },
        ...(level ? { level } : {}),
        ...(ownOnly ? { OR: [{ recorderId: principal.userId }, { teacherId: principal.userId }] } : {}),
      },
      orderBy: [{ date: "desc" }, { submittedAt: "desc" }],
      include: {
        recorder: { select: { firstName: true, lastName: true } },
        records: { select: { status: true } },
      },
    });

    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle title="Absences" subtitle={ownOnly ? "Vos appels" : "Appels"} />
          <div className="flex flex-wrap items-start gap-3">
          <form method="get" className="flex flex-wrap items-center gap-2">
            {level ? <input type="hidden" name="level" value={level} /> : null}
            <label className="flex items-center gap-1 text-sm text-ink/70">
              Du
              <input
                type="date"
                name="from"
                defaultValue={from}
                max={today}
                aria-label="Date de début"
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <label className="flex items-center gap-1 text-sm text-ink/70">
              au
              <input
                type="date"
                name="to"
                defaultValue={to}
                max={today}
                aria-label="Date de fin"
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <button type="submit" className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95">
              Voir
            </button>
          </form>
          <ExportButton resource="attendance" params={{ level }} label="Exporter les présences" />
          <Link
            href="/absences/take"
            className="min-h-11 rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
          >
            Faire l&apos;appel
          </Link>
          </div>
        </div>
        <nav aria-label="Période" className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {presets.map((p) => {
            const current = from === p.from && to === p.to;
            return (
              <Link
                key={p.label}
                href={`/absences?${new URLSearchParams({ ...(level ? { level } : {}), ...(p.from === today && p.to === today ? {} : { from: p.from, to: p.to }) })}`}
                aria-current={current ? "page" : undefined}
                className={`min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                  current ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Filtrer par niveau" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", name: "" }, ...levels].map((l) => (
            <Link
              key={l.id}
              href={`/absences?${new URLSearchParams({ ...(l.name ? { level: l.name } : {}), ...(isToday ? {} : { from, to }) })}`}
              aria-current={(level ?? "") === l.name ? "page" : undefined}
              className={`min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                (level ?? "") === l.name ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
              }`}
            >
              {l.name || "Tous"}
            </Link>
          ))}
        </nav>
        <Card>
          <ul className="grid gap-2">
            {sessions.map((s) => {
              const n = (status: keyof typeof LABELS) => s.records.filter((r) => r.status === status).length;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
                  <div>
                    <p className="font-medium">{s.level} · {s.subject ?? "Hors emploi du temps"}</p>
                    <p className="text-xs text-ink/70">
                      {isRange ? <>{s.date.toLocaleDateString("fr-FR")} · </> : null}
                      {s.recorder.firstName} {s.recorder.lastName} ·{" "}
                      {s.submittedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.subject ? (
                      <Link
                        href={`/cahier-de-texte?${new URLSearchParams({ new: "1", level: s.level, subject: s.subject, date: s.date.toISOString().slice(0, 10), ...(s.slotId ? { slot: s.slotId } : {}) })}`}
                        className="rounded-xl bg-peach/15 px-3 py-1 text-xs text-peach outline-none hover:bg-peach/25 focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        Remplir le cahier de texte
                      </Link>
                    ) : null}
                    {s.isOverdue ? (
                      <Badge tone="warning">
                        Hors créneau{s.offsetMinutes ? ` ${s.offsetMinutes > 0 ? "+" : ""}${s.offsetMinutes} min` : ""}
                      </Badge>
                    ) : null}
                    <Badge tone="success">{n("PRESENT")} présents</Badge>
                    {n("ABSENT") ? <Badge tone="danger">{n("ABSENT")} absents</Badge> : null}
                    {n("LATE") ? <Badge tone="warning">{n("LATE")} retards</Badge> : null}
                    {canDelete ? <DeleteButton id={s.id} action={deleteAttendanceSession} label="cet appel" /> : null}
                  </div>
                </li>
              );
            })}
            {sessions.length === 0 ? (
              <li className="text-ink/70">
                {isToday
                  ? "Aucun appel enregistré aujourd'hui."
                  : isRange
                    ? `Aucun appel enregistré du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}.`
                    : `Aucun appel enregistré le ${new Date(from).toLocaleDateString("fr-FR")}.`}
              </li>
            ) : null}
          </ul>
        </Card>
      </>
    );
  }

  const records =
    principal.role === "STUDENT"
      ? await db.attendanceRecord.findMany({ where: { studentId: principal.userId }, orderBy: { date: "desc" }, take: 30 })
      : [];

  return (
    <>
      <PageTitle title="Mes absences" />
      <Card>
        <ul className="grid gap-2">
          {records.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
              <span className="tabular-nums">{r.date.toLocaleDateString("fr-FR")}</span>
              <Badge tone={TONES[r.status]}>{LABELS[r.status]}</Badge>
            </li>
          ))}
          {records.length === 0 ? <li className="text-ink/70">Aucun enregistrement.</li> : null}
        </ul>
      </Card>
    </>
  );
}
