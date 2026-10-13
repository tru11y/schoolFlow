import Link from "next/link";
import { groupThreadsByAge } from "@/core/domain/copilot/threads";
import { listThreads, loadThread } from "@/infrastructure/copilot/thread-service";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { llmEnabled } from "@/infrastructure/copilot/claude-assistant";
import { prisma } from "@/infrastructure/db/prisma";
import { Chat } from "./chat";
import { ThreadPanel } from "./thread-panel";

export const metadata = { title: "Copilote IA · SchoolFlow" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AiAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string; thread?: string; n?: string }> }) {
  const principal = await requirePagePermission("copilot:use");
  const { q, thread: threadParam, n } = await searchParams;
  const db = tenantPrisma(principal);

  const [threads, active] = await Promise.all([
    listThreads(db, principal.userId),
    threadParam && UUID.test(threadParam) ? loadThread(db, principal.userId, threadParam) : null,
  ]);
  const counts = new Map(threads.map((t) => [t.id, t.messageCount]));
  const now = new Date();
  const time = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "Europe/Paris" });
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  const groups = groupThreadsByAge(threads, now).map((g) => ({
    label: g.label,
    threads: g.threads.map((t) => {
      const n = counts.get(t.id) ?? 0;
      return { id: t.id, title: t.title, meta: `${g.label === "Aujourd'hui" ? time.format(t.updatedAt) : day.format(t.updatedAt)} • ${n} message${n > 1 ? "s" : ""}` };
    }),
  }));
  const me = await prisma.user.findUnique({ where: { id: principal.userId }, select: { firstName: true, lastName: true } });
  const initials = me ? `${me.firstName[0] ?? ""}${me.lastName[0] ?? ""}`.toUpperCase() : "";
  const aiOn = llmEnabled();

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Copilote IA</h1>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${aiOn ? "bg-accent/10 text-accent ring-accent/25" : "bg-raised text-ink/70 ring-ink/15"}`}>
            <span aria-hidden className={`size-1.5 rounded-full ${aiOn ? "bg-mint" : "bg-ink/40"}`} />
            {aiOn ? "Claude actif" : "IA non configurée"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ai-assistant/growth"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            📈 Stratégie &amp; benchmark marché
          </Link>
          <Link
            href="/ai-assistant/competitors"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            🏷️ Concurrents
          </Link>
        </div>
      </header>
      {/* Side by side from md up (history 18 rem, chat fills the rest); stacked on mobile. Both panels scroll inside a bounded height. */}
      <div className="flex w-full flex-col items-stretch gap-6 md:h-[calc(100dvh-15rem)] md:min-h-[34rem] md:flex-row md:items-start md:overflow-hidden">
        <details className="w-full rounded-3xl bg-surface p-3 ring-1 ring-ink/10 md:hidden">
          <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold">Historique des conversations</summary>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <ThreadPanel groups={groups} activeId={active?.id ?? null} />
          </div>
        </details>
        <aside className="hidden h-full w-72 shrink-0 flex-col rounded-3xl bg-surface p-4 ring-1 ring-ink/10 md:flex">
          <div className="min-h-0 flex-1">
            <ThreadPanel groups={groups} activeId={active?.id ?? null} />
          </div>
          <p className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-ink/10 pt-3 text-[11px] text-ink/70">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className={`size-2 rounded-full ${aiOn ? "bg-mint" : "bg-ink/40"}`} />
              {aiOn ? "Recherche web OSINT disponible" : "Recherche web indisponible"}
            </span>
            <span className="rounded bg-raised px-1.5 py-0.5">FB / IG / TT</span>
          </p>
        </aside>
        <div className="h-[75dvh] min-h-0 w-full min-w-0 flex-1 md:h-full">
          <Chat
            key={active?.id ?? n ?? "new"}
            threadId={active?.id}
            initials={initials}
            initialTurns={active?.turns}
            initialQuestion={active ? undefined : q?.slice(0, 300)}
          />
        </div>
      </div>
    </>
  );
}
