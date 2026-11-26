import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { localParts } from "@/core/domain/attendance/policy";
import { periodOf } from "@/core/domain/finance/billing";
import { can } from "@/core/domain/rbac/role";
import { ENROLLMENT_STATUSES, STATUS_LABELS, type EnrollmentStatusValue } from "@/core/domain/students/student";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { ExportButton } from "@/presentation/components/export-button";
import { DeleteStudentButton } from "./delete-student";
import { ToggleStudentActiveButton } from "./toggle-student-active";
import { STATUS_TONES } from "./status-tones";

const isStatus = (v: string | undefined): v is EnrollmentStatusValue => ENROLLMENT_STATUSES.some((s) => s === v);

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; status?: string; active?: string }>;
}) {
  const principal = await requirePagePermission("user:manage");
  const { q, level, status, active } = await searchParams;
  const query = q?.trim().slice(0, 80);
  const levels = await listLevels(tenantPrisma(principal));

  const profile: Prisma.StudentProfileWhereInput = {
    ...(level && levels.some((l) => l.name === level) ? { level } : {}),
    ...(isStatus(status) ? { status } : {}),
  };
  const students = await tenantPrisma(principal).user.findMany({
    where: {
      role: "STUDENT",
      deletedAt: null,
      ...(active === "active" ? { isActive: true } : active === "inactive" ? { isActive: false } : {}),
      ...(Object.keys(profile).length ? { profile } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { lastName: "asc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, email: true, isActive: true, profile: { select: { level: true, status: true } } },
  });

  const field =
    "rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";
  const currentPeriod = periodOf(localParts(new Date()).date);
  const canCollect = can(principal.role, "finance:write");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Élèves" subtitle={`${students.length} résultat${students.length > 1 ? "s" : ""}`} />
        <div className="flex flex-wrap items-start gap-3">
          <ExportButton resource="students" params={{ q: query, level, status, active }} label="Exporter les élèves" />
          {canCollect ? (
            <form action="/api/export/collections" method="get" className="flex items-center gap-2">
              {level ? <input type="hidden" name="level" value={level} /> : null}
              <input
                type="month"
                name="period"
                defaultValue={currentPeriod}
                max={currentPeriod}
                aria-label="Mois à encaisser"
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
              />
              <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-surface px-5 py-3 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95">
                <span aria-hidden>⬇️</span>
                Feuille d&apos;encaissement
              </button>
            </form>
          ) : null}
          <Link
            href="/students/new"
            className="rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
          >
            + Nouvelle inscription
          </Link>
        </div>
      </div>

      <nav aria-label="Filtrer par niveau" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all", name: "" }, ...levels].map((l) => {
          const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { status } : {}), ...(active ? { active } : {}), ...(l.name ? { level: l.name } : {}) });
          const isCurrent = (level ?? "") === l.name;
          return (
            <Link
              key={l.id}
              href={`/students${params.size ? `?${params}` : ""}`}
              aria-current={isCurrent ? "page" : undefined}
              className={`min-h-9 whitespace-nowrap rounded-2xl px-4 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 ${
                isCurrent ? "bg-accent font-medium text-canvas" : "bg-surface hover:bg-raised"
              }`}
            >
              {l.name || "Tous"}
            </Link>
          );
        })}
      </nav>

      <form method="get" role="search" className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={query} placeholder="Rechercher un nom, un e-mail…" aria-label="Recherche" className={`${field} min-w-60 flex-1`} />
        <select name="level" defaultValue={level ?? ""} aria-label="Classe" className={field}>
          <option value="">Toutes les classes</option>
          {levels.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className={field}>
          <option value="">Tous les statuts</option>
          {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select name="active" defaultValue={active ?? ""} aria-label="Compte" className={field}>
          <option value="">Actifs et désactivés</option>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
        </select>
        <button className={`${field} bg-raised hover:bg-surface`}>Filtrer</button>
      </form>

      {/* Mobile: stacked cards */}
      <div className="grid gap-3 sm:hidden">
        {students.map((s) => (
          <div key={s.id} className="rounded-3xl bg-surface p-4 shadow-soft ring-1 ring-ink/5">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/students/${s.id}`} className="min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <span className="font-medium">{s.firstName} {s.lastName}</span>
                <span className="block truncate text-xs text-ink/70">{s.email}</span>
              </Link>
              <div className="flex items-center gap-1">
                <ToggleStudentActiveButton id={s.id} name={`${s.firstName} ${s.lastName}`} active={s.isActive} compact />
                <DeleteStudentButton id={s.id} name={`${s.firstName} ${s.lastName}`} compact />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge tone="neutral">{s.profile?.level ?? "—"}</Badge>
              {s.profile ? <Badge tone={STATUS_TONES[s.profile.status]}>{STATUS_LABELS[s.profile.status]}</Badge> : null}
              {!s.isActive ? <Badge tone="warning">Désactivé</Badge> : null}
            </div>
          </div>
        ))}
        {students.length === 0 ? (
          <p className="rounded-3xl bg-surface p-8 text-center text-sm text-ink/70 shadow-soft">Aucun élève trouvé.</p>
        ) : null}
      </div>

      <Card className="hidden overflow-x-auto p-2 sm:block sm:p-4">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Liste des élèves</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Classe</th>
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-ink/10 transition hover:bg-raised/50">
                <td className="px-4 py-3">
                  <Link href={`/students/${s.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="block text-xs text-ink/70">{s.email}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">{s.profile?.level ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.profile ? <Badge tone={STATUS_TONES[s.profile.status]}>{STATUS_LABELS[s.profile.status]}</Badge> : "—"}
                    {!s.isActive ? <Badge tone="warning">Désactivé</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ToggleStudentActiveButton id={s.id} name={`${s.firstName} ${s.lastName}`} active={s.isActive} compact />
                    <DeleteStudentButton id={s.id} name={`${s.firstName} ${s.lastName}`} compact />
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/70">Aucun élève trouvé.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
