import { requirePagePermission } from "@/presentation/auth/guards";
import { PageTitle } from "@/presentation/components/ui";
import { Chat } from "./chat";

export const metadata = { title: "Copilote IA · SchoolFlow" };

export default async function AiAssistantPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePagePermission("user:manage");
  const { q } = await searchParams;
  return (
    <>
      <PageTitle title="Copilote IA" subtitle="Impayés, assiduité, professeurs et croissance, en langage naturel" />
      <div className="max-w-3xl">
        <Chat initialQuestion={q?.slice(0, 300)} />
      </div>
    </>
  );
}
