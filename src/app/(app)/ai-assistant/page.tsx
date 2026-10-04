import Link from "next/link";
import { requirePagePermission } from "@/presentation/auth/guards";
import { PageTitle } from "@/presentation/components/ui";
import { Chat } from "./chat";

export const metadata = { title: "Copilote IA · SchoolFlow" };

export default async function AiAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePagePermission("copilot:use");
  const { q } = await searchParams;
  return (
    <>
      <PageTitle title="Copilote IA" subtitle="Impayés, assiduité, professeurs et croissance, en langage naturel" />
      <Link
        href="/ai-assistant/growth"
        className="mb-4 inline-flex min-h-11 items-center rounded-2xl bg-accent/15 px-5 text-sm font-semibold text-accent outline-none ring-1 ring-accent/30 transition hover:bg-accent/25 focus-visible:ring-2 active:scale-95"
      >
        📈 Stratégie &amp; benchmark marché
      </Link>
      <div className="max-w-3xl">
        <Chat initialQuestion={q?.slice(0, 300)} />
      </div>
    </>
  );
}
