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
      {/* Two columns from md up: fixed-width history on the left, the chat takes the remaining width. Stacked on mobile. */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <details className="rounded-3xl bg-surface/70 p-3 ring-1 ring-ink/10 md:hidden">
          <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold">Historique des conversations</summary>
          <div className="mt-3">
            <ThreadPanel groups={groups} activeId={active?.id ?? null} />
          </div>
        </details>
        <aside className="hidden w-64 shrink-0 rounded-3xl bg-surface/70 p-3 ring-1 ring-ink/10 md:block lg:w-72">
          <ThreadPanel groups={groups} activeId={active?.id ?? null} />
        </aside>
        <div className="mx-auto w-full min-w-0 max-w-3xl flex-1">
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
