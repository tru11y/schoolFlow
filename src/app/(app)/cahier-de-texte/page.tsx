import { can } from "@/core/domain/rbac/role";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Card, PageTitle } from "@/presentation/components/ui";
import { NoteForm } from "./note-form";

export default async function CahierPage() {
  const principal = await requirePagePermission("homework:read");
  const notes = await tenantPrisma(principal).homework.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { firstName: true, lastName: true } } },
  });

  return (
    <>
      <PageTitle title="Cahier de texte" subtitle="Le travail à faire, façon Notes" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          {notes.map((n) => (
            <article key={n.id} className="rounded-3xl bg-peach/10 p-6 shadow-soft ring-1 ring-peach/20">
              <header className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-peach">{n.title}</h2>
                <time dateTime={n.createdAt.toISOString()} className="text-xs text-ink/70">
                  {n.createdAt.toLocaleDateString("fr-FR")}
                </time>
              </header>
              <p className="mt-3 whitespace-pre-wrap leading-relaxed">{n.content}</p>
              <p className="mt-4 text-xs text-ink/70">{n.author.firstName} {n.author.lastName}</p>
            </article>
          ))}
          {notes.length === 0 ? <Card><p className="text-ink/70">Aucune note pour le moment.</p></Card> : null}
        </div>
        {can(principal.role, "homework:write") ? (
          <Card className="h-fit">
            <h2 className="mb-4 text-lg font-semibold">Nouvelle note</h2>
            <NoteForm />
          </Card>
        ) : null}
      </div>
    </>
  );
}
