import type { Prisma } from "@prisma/client";
import type { Principal } from "@/core/domain/auth/principal";
import type { AssistantReply } from "@/core/domain/copilot/assistant";
import { titleFrom, type ThreadSummary } from "@/core/domain/copilot/threads";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

type Db = ReturnType<typeof tenantPrisma>;

export interface StoredTurn {
  question: string;
  reply: AssistantReply;
}

const LIST_LIMIT = 100;

/** The principal's own live threads, newest first. Every query below also filters on `userId`: no cross-user access. */
export async function listThreads(db: Db, userId: string): Promise<(ThreadSummary & { messageCount: number })[]> {
  const rows = await db.copilotThread.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: LIST_LIMIT,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
  return rows.map(({ _count, ...t }) => ({ ...t, messageCount: _count.messages }));
}

export async function ownsThread(db: Db, userId: string, id: string): Promise<boolean> {
  return (await db.copilotThread.count({ where: { id, userId, deletedAt: null } })) > 0;
}

/** Full conversation as question/answer turns, or null when the thread is not the principal's. */
export async function loadThread(db: Db, userId: string, id: string): Promise<{ id: string; title: string; turns: StoredTurn[] } | null> {
  const thread = await db.copilotThread.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, title: true, messages: { orderBy: [{ createdAt: "asc" }, { role: "desc" }], select: { role: true, content: true, data: true } } },
  });
  if (!thread) return null;

  const turns: StoredTurn[] = [];
  for (const m of thread.messages) {
    if (m.role === "user") {
      turns.push({ question: m.content, reply: { intent: "help", text: "", items: [] } });
      continue;
    }
    const turn = turns.at(-1);
    if (!turn) continue;
    const extra = (m.data ?? {}) as Partial<Pick<AssistantReply, "intent" | "items" | "osint">>;
    turn.reply = { intent: extra.intent ?? "ai", text: m.content, items: extra.items ?? [], ...(extra.osint ? { osint: extra.osint } : {}) };
  }
  return { id: thread.id, title: thread.title, turns };
}

/**
 * Stores one question/answer pair, creating the thread (titled from the question) when `threadId` is null.
 * Returns the thread id. The caller has already checked ownership of an existing thread.
 */
export async function recordTurn(db: Db, principal: Principal, threadId: string | null, question: string, reply: AssistantReply): Promise<string> {
  const schoolId = principal.schoolId;
  if (!schoolId) throw new Error("tenant:missing");

  const id = threadId ?? (await db.copilotThread.create({ data: { schoolId, userId: principal.userId, title: titleFrom(question) }, select: { id: true } })).id;
  const now = Date.now();
  const data = { intent: reply.intent, items: reply.items, ...(reply.osint ? { osint: reply.osint } : {}) } as unknown as Prisma.InputJsonValue;

  await db.copilotMessage.createMany({
    data: [
      { schoolId, threadId: id, role: "user", content: question, createdAt: new Date(now) },
      { schoolId, threadId: id, role: "assistant", content: reply.text, data, createdAt: new Date(now + 1) },
    ],
  });
  // Bumps updatedAt so the thread moves to the top of the history.
  await db.copilotThread.updateMany({ where: { id, userId: principal.userId }, data: { updatedAt: new Date() } });
  return id;
}
