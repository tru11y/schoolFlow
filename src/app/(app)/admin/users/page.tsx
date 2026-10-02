import type { Prisma } from "@prisma/client";
import { ROLES, type Role } from "@/core/domain/rbac/role";
import { ROLE_LABELS, canManageRole } from "@/core/domain/rbac/user-management";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { CreateUser } from "./create-user";
import { UserActions } from "./user-actions";

const isRole = (v: string | undefined): v is Role => ROLES.some((r) => r === v);

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const principal = await requirePagePermission("user:manage");
  const { q, role, status } = await searchParams;
  const query = q?.trim().slice(0, 80);
  const db = tenantPrisma(principal);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(isRole(role) ? { role } : {}),
    ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [users, students] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, isActive: true, specialty: true },
    }),
    db.user.findMany({
      where: { role: "STUDENT", deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const creatable = ROLES.filter((r) => canManageRole(principal.role, r));
  const field =
    "rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title="Utilisateurs" subtitle={`${users.length} compte${users.length > 1 ? "s" : ""}`} />
        <CreateUser roles={creatable} students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))} />
      </div>

      <form method="get" role="search" className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={query} placeholder="Rechercher un nom, un e-mail…" aria-label="Recherche" className={`${field} min-w-60 flex-1`} />
        <select name="role" defaultValue={role ?? ""} aria-label="Rôle" className={field}>
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className={field}>
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
        <button className={`${field} bg-raised hover:bg-surface`}>Filtrer</button>
      </form>

      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Liste des comptes</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Utilisateur</th>
              <th scope="col" className="px-4 py-3 font-medium">Rôle</th>
              <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const manageable = u.id !== principal.userId && canManageRole(principal.role, u.role);
              return (
                <tr key={u.id} className="border-t border-white/10 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-ink/70">
                      {u.email}{u.phone ? ` · ${u.phone}` : ""}{u.specialty ? ` · ${u.specialty}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3"><Badge tone="info">{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {manageable ? (
                      <UserActions id={u.id} role={u.role} active={u.isActive} assignable={creatable} />
                    ) : (
                      <p className="text-right text-xs text-ink/60">{u.id === principal.userId ? "Vous" : "—"}</p>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/70">Aucun compte trouvé.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
