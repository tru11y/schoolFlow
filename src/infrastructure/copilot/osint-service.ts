import Anthropic from "@anthropic-ai/sdk";
import { localParts } from "@/core/domain/attendance/policy";
import type { Principal } from "@/core/domain/auth/principal";
import type { CompetitorView } from "@/core/domain/copilot/competitors";
import { buildOsintPrompt, competitorLinks, OSINT_SYSTEM_PROMPT, withSources, type OsintSource } from "@/core/domain/copilot/osint";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { loadCompetitors } from "./competitor-service";
import { loadSnapshot } from "./copilot-service";
import { chatApiKey, clean } from "./llm-env";

const MODEL = process.env.OSINT_MODEL ?? "claude-haiku-4-5";
const MAX_SEARCHES = 3;
const MAX_TURNS = 3;

export interface OsintResult {
  text: string;
  /** cache = today's stored analysis; web = fresh analysis with web search; offline = fresh analysis without it */
  source: "cache" | "web" | "offline";
  competitor: string;
}

export type OsintOutcome = { ok: true; result: OsintResult } | { ok: false; reason: "no-key" | "not-found" | "failed" };

let client: Anthropic | undefined;
const getClient = () =>
  (client ??= new Anthropic({
    apiKey: chatApiKey(),
    defaultHeaders: clean(process.env.ANTHROPIC_WORKSPACE_ID) ? { "anthropic-workspace-id": clean(process.env.ANTHROPIC_WORKSPACE_ID)! } : {},
    timeout: 50_000,
    maxRetries: 0,
  }));

const textOf = (blocks: Anthropic.ContentBlock[]) =>
  blocks.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();

/** URLs the model consulted: search results plus the citations attached to its answer. */
function sourcesOf(blocks: Anthropic.ContentBlock[]): OsintSource[] {
  const sources: OsintSource[] = [];
  for (const block of blocks) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) sources.push({ title: r.title ?? "", url: r.url });
    }
    if (block.type === "text") {
      for (const c of block.citations ?? []) if (c.type === "web_search_result_location") sources.push({ title: c.title ?? "", url: c.url });
    }
  }
  return sources;
}

/**
 * Asks the model to research a competitor's PUBLIC presence with the Anthropic web search tool.
 * Pages are never fetched by our servers: Facebook and others block scraping, and the search runs on Anthropic's side.
 */
async function analyse(prompt: string, withWeb: boolean): Promise<{ text: string; sources: OsintSource[] }> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  const sources: OsintSource[] = [];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: OSINT_SYSTEM_PROMPT,
      messages,
      ...(withWeb ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: MAX_SEARCHES }] } : {}),
    });
    sources.push(...sourcesOf(res.content));
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error("refusal");
    const text = textOf(res.content);
    if (!text) throw new Error("empty completion");
    return { text, sources };
  }
  throw new Error("pause_turn limit");
}

/** One analysis per competitor and day (stored in ai_reports) keeps the web-search cost bounded. */
export async function researchCompetitor(principal: Principal, competitorId: string, now: Date = new Date()): Promise<OsintOutcome> {
  if (!chatApiKey() || !principal.schoolId) return { ok: false, reason: "no-key" };
  const db = tenantPrisma(principal);
  const competitors = await loadCompetitors(db);
  const competitor: CompetitorView | undefined = competitors.find((c) => c.id === competitorId);
  if (!competitor) return { ok: false, reason: "not-found" };

  const scope = `osint:${competitor.id}`;
  const day = new Date(localParts(now).date);
  const cached = await db.aiReport.findFirst({ where: { scope, day }, select: { content: true } });
  if (cached) return { ok: true, result: { text: cached.content, source: "cache", competitor: competitor.name } };

  const snapshot = await loadSnapshot(principal, now);
  const prompt = buildOsintPrompt(competitor, competitorLinks(competitor), {
    schoolName: snapshot.schoolName,
    currency: snapshot.currency,
    levels: snapshot.levels.map((l) => ({ level: l.level, feeCents: l.feeCents ?? null })),
  });

  let source: OsintResult["source"] = "web";
  let outcome: { text: string; sources: OsintSource[] };
  try {
    outcome = await analyse(prompt, true);
  } catch (err) {
    // Web search can be disabled for the organisation: still give a strategy from the registered data.
    console.error("osint web analysis failed", err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err instanceof Error ? err.message : "unknown");
    try {
      outcome = await analyse(prompt, false);
      source = "offline";
    } catch (err2) {
      console.error("osint offline analysis failed", err2 instanceof Error ? err2.message : "unknown");
      return { ok: false, reason: "failed" };
    }
  }

  const note = source === "offline" ? "\n\n(Recherche web indisponible : analyse limitée aux données saisies.)" : "";
  const text = withSources(outcome.text, outcome.sources) + note;
  if (source === "web") {
    await db.aiReport.create({ data: { schoolId: principal.schoolId, scope, day, content: text, model: MODEL } }).catch(() => undefined);
  }
  return { ok: true, result: { text, source, competitor: competitor.name } };
}
