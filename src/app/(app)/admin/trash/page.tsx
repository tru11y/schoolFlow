import { ROLE_LABELS } from "@/core/domain/rbac/user-management";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import type { TrashKind } from "./kinds";
import { RestoreButton } from "./restore-button";

export const metadata = { title: "Corbeille · SchoolFlow" };

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });
const deleted = { deletedAt: { not: null } } as const;
const take = 100;

interface Row {
  id: string;
  kind: TrashKind;
  type: string;
  name: string;
  detail: string;
  deletedAt: Date;
}

export default async function TrashPage() {
  const principal = await requirePagePermission("user:manage");
  const db = tenantPrisma(principal);

  const [users, chapters, logbook, sessions, competitors] = await Promise.all([
    db.user.findMany({ where: deleted, take, select: { id: true, firstName: true, lastName: true, role: true, deletedAt: true, profile: { select: { level: true, matricule: true } } } }),
    db.curriculumChapter.findMany({ where: deleted, take, select: { id: true, level: true, subject: true, title: true, deletedAt: true } }),
    db.logbookEntry.findMany({ where: deleted, take, select: { id: true, level: true, subject: true, title: true, deletedAt: true } }),
    db.attendanceSession.findMany({ where: deleted, take, select: { id: true, level: true, subject: true, date: true, deletedAt: true } }),
    db.competitor.findMany({ where: deleted, take, select: { id: true, name: true, area: true, deletedAt: true } }),
  ]);

  const rows: Row[] = [
    ...users.map((u): Row => ({
      id: u.id, kind: "user", type: ROLE_LABELS[u.role], name: `${u.firstName} ${u.lastName}`,
      detail: [u.profile?.level, u.profile?.matricule && `Matricule ${u.profile.matricule}`].filter(Boolean).join(" · "), deletedAt: u.deletedAt!,
    })),
    ...chapters.map((c): Row => ({ id: c.id, kind: "chapter", type: "Chapitre", name: c.title, detail: `${c.subject} · ${c.level}`, deletedAt: c.deletedAt! })),
    ...logbook.map((e): Row => ({ id: e.id, kind: "logbook", type: "Cahier de texte", name: e.title, detail: `${e.subject} · ${e.level}`, deletedAt: e.deletedAt! })),
    ...sessions.map((s): Row => ({
      id: s.id, kind: "attendance", type: "Appel", name: `${s.subject ?? "Hors emploi du temps"} · ${s.level}`,
      detail: fmt.format(s.date), deletedAt: s.deletedAt!,
    })),
    ...competitors.map((c): Row => ({ id: c.id, kind: "competitor", type: "Concurrent", name: c.name, detail: c.area ?? "", deletedAt: c.deletedAt! })),
  ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return (
    <>
      <PageTitle title="Corbeille" subtitle={`${rows.length} élément${rows.length > 1 ? "s" : ""} supprimé${rows.length > 1 ? "s" : ""}`} />
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Éléments supprimés</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élément</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Supprimé le</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`} className="border-t border-ink/10">
                <td className="px-4 py-3">
                  <span className="font-medium">{r.name}</span>
                  {r.detail ? <span className="block text-xs text-ink/70">{r.detail}</span> : null}
                </td>
                <td className="px-4 py-3">{r.type}</td>
                <td className="px-4 py-3">{fmt.format(r.deletedAt)}</td>
                <td className="px-4 py-3 text-right"><RestoreButton id={r.id} kind={r.kind} name={r.name} /></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/70">La corbeille est vide.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
