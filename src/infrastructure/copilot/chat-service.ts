import type { Principal } from "@/core/domain/auth/principal";
import type { CopilotSnapshot } from "@/core/domain/copilot/types";
import { answer, type AssistantReply } from "@/core/domain/copilot/assistant";
import { mergeAiResult } from "@/core/domain/copilot/chat-merge";
import { buildMarketingContext, competitorLinks, isMarketingQuestion, MARKETING_HINT } from "@/core/domain/copilot/osint";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { mentioned } from "@/core/domain/copilot/competitors";
import { askClaude } from "./claude-assistant";
import { loadSnapshot } from "./copilot-service";

/**
 * Known topics keep their deterministic reply (with one-click links, zero token).
 * Anything else goes to the model; if it is missing or fails, the local reply is returned instead.
 */
export async function replyTo(principal: Principal, question: string): Promise<AssistantReply> {
  const snapshot = await loadSnapshot(principal);
  const local = answer(question, snapshot);
  if (isMarketingQuestion(question)) return marketingAdvice(principal, question, snapshot, local);
  if (local.intent === "competitors") return competitorStrategy(question, snapshot, local);
  if (local.intent !== "help") return local;
  return mergeAiResult(local, await askClaude(question, snapshot));
}

const STRATEGY_HINT = [
  "La question porte sur la concurrence. Rédige une vraie réponse structurée, pas une simple liste :",
  "1) compare les tarifs des concurrents enregistrés avec notre grille, niveau par niveau ;",
  "2) points forts et faiblesses de chaque concurrent d'après les offres et commentaires saisis ;",
  "3) plan d'action en 3 points, concret, pour capter des élèves face à eux. Reste factuel : n'invente aucun tarif.",
].join(" ");

/** Written strategy from the model, plus one button per competitor to launch the web analysis. Local reply when the model is unavailable. */
async function competitorStrategy(question: string, snapshot: CopilotSnapshot, local: AssistantReply): Promise<AssistantReply> {
  const list = snapshot.competitors ?? [];
  const ai = await askClaude(question, snapshot, STRATEGY_HINT);
  if (!ai.text) return mergeAiResult(local, ai);

  const named = mentioned(question, list);
  // Without a named competitor, offer the ones that have public pages first (that is where the web analysis finds the most).
  const targets = (named.length > 0 ? named : [...list].sort((a, b) => competitorLinks(b).length - competitorLinks(a).length)).slice(0, 3);
  return {
    intent: "ai",
    text: ai.text,
    items: [{ title: "Gérer les concurrents", detail: "", links: [{ label: "Ouvrir la liste", kind: "page", href: "/ai-assistant/competitors" }] }],
    osint: targets.map((c) => ({ id: c.id, name: c.name })),
  };
}

/**
 * "What should we post?": the model writes concrete posts from our data, the competitors and the web analyses already run
 * (cached in ai_reports). Competitors without an analysis get a button to run one.
 */
async function marketingAdvice(principal: Principal, question: string, snapshot: CopilotSnapshot, local: AssistantReply): Promise<AssistantReply> {
  const list = snapshot.competitors ?? [];
  const names = new Map(list.map((c) => [`osint:${c.id}`, c.name]));
  const rows = await tenantPrisma(principal).aiReport.findMany({
    where: { scope: { startsWith: "osint:" } },
    orderBy: { day: "desc" },
    take: 30,
    select: { scope: true, content: true },
  });
  const latest = new Map<string, string>();
  for (const r of rows) if (names.has(r.scope) && !latest.has(r.scope)) latest.set(r.scope, r.content);

  const analyses = [...latest].map(([scope, text]) => ({ competitor: names.get(scope)!, text }));
  const ai = await askClaude(question, snapshot, `${MARKETING_HINT}\n\n${buildMarketingContext(analyses)}`);
  if (!ai.text) return mergeAiResult(local, ai);

  const missing = list.filter((c) => !latest.has(`osint:${c.id}`)).sort((a, b) => competitorLinks(b).length - competitorLinks(a).length).slice(0, 3);
  return { intent: "ai", text: ai.text, items: [], osint: missing.map((c) => ({ id: c.id, name: c.name })) };
}
