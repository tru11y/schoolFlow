import Link from "next/link";
import { groupThreadsByAge } from "@/core/domain/copilot/threads";
import { listThreads, loadThread } from "@/infrastructure/copilot/thread-service";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { PageTitle } from "@/presentation/components/ui";
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
  const groups = groupThreadsByAge(threads, new Date()).map((g) => ({ label: g.label, threads: g.threads.map((t) => ({ id: t.id, title: t.title })) }));

  return (
    <>
      <PageTitle title="Copilote IA" subtitle="Impayés, assiduité, professeurs et croissance, en langage naturel" />
      <Link
        href="/ai-assistant/growth"
        className="mb-4 inline-flex min-h-11 items-center rounded-2xl bg-accent/15 px-5 text-sm font-semibold text-accent outline-none ring-1 ring-accent/30 transition hover:bg-accent/25 focus-visible:ring-2 active:scale-95"
      >
        📈 Stratégie &amp; benchmark marché
      </Link>
      <Link
        href="/ai-assistant/competitors"
        className="mb-4 ml-2 inline-flex min-h-11 items-center rounded-2xl bg-surface px-5 text-sm font-semibold outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
      >
        🏷️ Concurrents
      </Link>
      {/* Side by side from md up (history 18 rem, chat fills the rest); stacked on mobile. Both panels scroll inside a bounded height. */}
      <div className="flex w-full flex-col items-stretch gap-6 md:h-[calc(100dvh-15rem)] md:min-h-[34rem] md:flex-row md:items-start md:overflow-hidden">
        <details className="w-full rounded-3xl bg-surface p-3 ring-1 ring-ink/10 md:hidden">
          <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold">Historique des conversations</summary>
          <div className="mt-3 max-h-72 overflow-y-auto">
            <ThreadPanel groups={groups} activeId={active?.id ?? null} />
          </div>
        </details>
        <aside className="hidden h-full w-72 shrink-0 flex-col rounded-3xl bg-surface p-4 ring-1 ring-ink/10 md:flex">
          <ThreadPanel groups={groups} activeId={active?.id ?? null} />
        </aside>
        <div className="h-[75dvh] min-h-0 w-full min-w-0 flex-1 md:h-full">
          <Chat
            key={active?.id ?? n ?? "new"}
            threadId={active?.id}
            initialTurns={active?.turns}
            initialQuestion={active ? undefined : q?.slice(0, 300)}
          />
        </div>
      </div>
    </>
  );
}
