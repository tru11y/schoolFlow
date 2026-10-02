import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ENROLLMENT_STATUSES, LEVELS, STATUS_LABELS, type EnrollmentStatusValue } from "@/core/domain/students/student";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { STATUS_TONES } from "./status-tones";

const isStatus = (v: string | undefined): v is EnrollmentStatusValue => ENROLLMENT_STATUSES.some((s) => s === v);

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; level?: string; status?: string }>;
}) {
  const principal = await requirePagePermission("user:manage");
  const { q, level, status } = await searchParams;
  const query = q?.trim().slice(0, 80);

  const profile: Prisma.StudentProfileWhereInput = {
    ...(level && LEVELS.some((l) => l === level) ? { level } : {}),
    ...(isStatus(status) ? { status } : {}),
  };
  const students = await tenantPrisma(principal).user.findMany({
    where: {
      role: "STUDENT",
      deletedAt: null,
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
    select: { id: true, firstName: true, lastName: true, email: true, profile: { select: { level: true, status: true } } },
  });

  const field =
    "rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Élèves" subtitle={`${students.length} résultat${students.length > 1 ? "s" : ""}`} />
        <Link
          href="/students/new"
          className="rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
        >
          + Nouvelle inscription
        </Link>
      </div>

      <form method="get" role="search" className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={query} placeholder="Rechercher un nom, un e-mail…" aria-label="Recherche" className={`${field} min-w-60 flex-1`} />
        <select name="level" defaultValue={level ?? ""} aria-label="Classe" className={field}>
          <option value="">Toutes les classes</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className={field}>
          <option value="">Tous les statuts</option>
          {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <button className={`${field} bg-raised hover:bg-surface`}>Filtrer</button>
      </form>

      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Liste des élèves</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Classe</th>
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-white/10 transition hover:bg-raised/50">
                <td className="px-4 py-3">
                  <Link href={`/students/${s.id}`} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    <span className="block text-xs text-ink/70">{s.email}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">{s.profile?.level ?? "—"}</td>
                <td className="px-4 py-3">
                  {s.profile ? <Badge tone={STATUS_TONES[s.profile.status]}>{STATUS_LABELS[s.profile.status]}</Badge> : "—"}
                </td>
              </tr>
            ))}
            {students.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-ink/70">Aucun élève trouvé.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
