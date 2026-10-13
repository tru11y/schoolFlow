import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { RestoreButton } from "./restore-button";

export const metadata = { title: "Corbeille · SchoolFlow" };

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

export default async function TrashPage() {
  const principal = await requirePagePermission("user:manage");
  const students = await tenantPrisma(principal).user.findMany({
    where: { role: "STUDENT", deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, deletedAt: true, profile: { select: { level: true, matricule: true } } },
  });

  return (
    <>
      <PageTitle title="Corbeille" subtitle={`${students.length} élève${students.length > 1 ? "s" : ""} supprimé${students.length > 1 ? "s" : ""}`} />
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Élèves supprimés</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Élève</th>
              <th scope="col" className="px-4 py-3 font-medium">Classe</th>
              <th scope="col" className="px-4 py-3 font-medium">Supprimé le</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-ink/10">
                <td className="px-4 py-3">
                  <span className="font-medium">{s.firstName} {s.lastName}</span>
                  {s.profile?.matricule ? <span className="block text-xs text-ink/70">Matricule {s.profile.matricule}</span> : null}
                </td>
                <td className="px-4 py-3">{s.profile?.level ?? "—"}</td>
                <td className="px-4 py-3">{s.deletedAt ? fmt.format(s.deletedAt) : "—"}</td>
                <td className="px-4 py-3 text-right"><RestoreButton id={s.id} name={`${s.firstName} ${s.lastName}`} /></td>
              </tr>
            ))}
            {students.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-ink/70">La corbeille est vide.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
