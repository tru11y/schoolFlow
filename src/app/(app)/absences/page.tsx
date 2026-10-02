import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { can } from "@/core/domain/rbac/role";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";

const LABELS = { PRESENT: "Présent", ABSENT: "Absent", LATE: "Retard" } as const;
const TONES = { PRESENT: "success", ABSENT: "danger", LATE: "warning" } as const;

export default async function AbsencesPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const principal = await requirePagePermission("attendance:read");
  const db = tenantPrisma(principal);

  if (can(principal.role, "attendance:write")) {
    const levels = await listLevels(db);
    const { level: rawLevel } = await searchParams;
    const level = levels.find((l) => l.name === rawLevel)?.name;
    const sessions = await db.attendanceSession.findMany({
      where: { date: new Date(localParts(new Date()).date), ...(level ? { level } : {}) },
      orderBy: { submittedAt: "desc" },
      include: {
        recorder: { select: { firstName: true, lastName: true } },
        records: { select: { status: true } },
      },
    });

    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle title="Absences" subtitle="Appels du jour" />
          <Link
            href="/absences/take"
            className="min-h-11 rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
          >
            Faire l&apos;appel
          </Link>
        </div>
        <nav aria-label="Filtrer par niveau" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "all", name: "" }, ...levels].map((l) => (
            <Link
              key={l.id}
              href={l.name ? `/absences?level=${encodeURIComponent(l.name)}` : "/absences"}
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
                      {s.recorder.firstName} {s.recorder.lastName} ·{" "}
                      {s.submittedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {s.isOverdue ? (
                      <Badge tone="warning">
                        Hors créneau{s.offsetMinutes ? ` ${s.offsetMinutes > 0 ? "+" : ""}${s.offsetMinutes} min` : ""}
                      </Badge>
                    ) : null}
                    <Badge tone="success">{n("PRESENT")} présents</Badge>
                    {n("ABSENT") ? <Badge tone="danger">{n("ABSENT")} absents</Badge> : null}
                    {n("LATE") ? <Badge tone="warning">{n("LATE")} retards</Badge> : null}
                  </div>
                </li>
              );
            })}
            {sessions.length === 0 ? <li className="text-ink/70">Aucun appel enregistré aujourd&apos;hui.</li> : null}
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
