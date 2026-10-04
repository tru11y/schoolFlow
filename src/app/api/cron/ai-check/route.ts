import { timingSafeEqual } from "node:crypto";
import { pingChat } from "@/infrastructure/copilot/claude-assistant";
import { llmFromEnv } from "@/infrastructure/copilot/llm-env";
import { env } from "@/infrastructure/env/env";

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const brief = (err: unknown) => (err instanceof Error ? err.message.slice(0, 400) : "unknown");

/**
 * Health check of the AI wiring (same auth as the crons). Makes two 5-token calls, one per code path
 * (summaries via REST, chat via SDK) and reports status only: never the key, the prompt or any school data.
 */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return new Response("Not configured", { status: 503 });
  if (!authorized(req.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });

  const e = env();
  const llm = llmFromEnv({ AI_PROVIDER: e.AI_PROVIDER, AI_API_KEY: e.AI_API_KEY, AI_MODEL: e.AI_MODEL, ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID: e.ANTHROPIC_WORKSPACE_ID });

  const summaries: Record<string, unknown> = { configured: Boolean(llm), model: llm?.model ?? null };
  if (llm) {
    try {
      summaries.ok = (await llm.complete("Réponds uniquement par le mot ok.", "ping")).trim().length > 0;
    } catch (err) {
      summaries.ok = false;
      summaries.error = brief(err);
    }
  }
  return Response.json({ summaries, chat: await pingChat() });
}
