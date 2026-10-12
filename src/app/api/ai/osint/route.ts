import { z } from "zod";
import { can } from "@/core/domain/rbac/role";
import { container } from "@/presentation/auth/container";
import { getPrincipal } from "@/presentation/auth/guards";
import { researchCompetitor } from "@/infrastructure/copilot/osint-service";
import { ownsThread, recordTurn } from "@/infrastructure/copilot/thread-service";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";

/** Web search + analysis: allow more time than the plain chat (the model call itself is capped at 50 s). */
export const maxDuration = 60;

const body = z.object({ competitorId: z.string().uuid(), threadId: z.string().uuid().optional() });

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

/** Competitor OSINT analysis. Access follows the role (`copilot:use`, SUPER_ADMIN only), never an e-mail address. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return json({ error: "Requête refusée." }, 403);

  const principal = await getPrincipal();
  if (!principal) return json({ error: "Session expirée. Reconnectez-vous puis réessayez." }, 401);

  const audit = (outcome: "SUCCESS" | "DENIED" | "FAILURE", metadata: unknown) =>
    container().audit.record({
      schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
      action: "COPILOT_OSINT", resource: "competitor", resourceId: null, outcome,
      ip: clientIp(req), userAgent: req.headers.get("user-agent"), metadata,
    });

  if (!can(principal.role, "copilot:use") || !principal.schoolId) {
    await audit("DENIED", { reason: "copilot:use" });
    return json({ error: "Le Copilote IA est réservé au SuperAdmin." }, 403);
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Concurrent invalide." }, 400);

  const db = tenantPrisma(principal);
  const { threadId } = parsed.data;
  if (threadId && !(await ownsThread(db, principal.userId, threadId))) return json({ error: "Conversation introuvable." }, 404);

  try {
    const outcome = await researchCompetitor(principal, parsed.data.competitorId);
    if (!outcome.ok) {
      await audit("FAILURE", { competitorId: parsed.data.competitorId, reason: outcome.reason });
      const message =
        outcome.reason === "no-key" ? "Aucune clé IA configurée (ANTHROPIC_API_KEY)."
        : outcome.reason === "not-found" ? "Concurrent introuvable."
        : "L'analyse OSINT est momentanément indisponible. Réessayez dans un instant.";
      return json({ error: message }, outcome.reason === "not-found" ? 404 : 502);
    }
    await audit("SUCCESS", { competitorId: parsed.data.competitorId, source: outcome.result.source });
    const savedId = await recordTurn(db, principal, threadId ?? null, `Analyse OSINT détaillée : ${outcome.result.competitor}`, {
      intent: "ai", text: outcome.result.text, items: [],
    }).catch((err: unknown) => {
      console.error("copilot history save failed", err instanceof Error ? err.message : "unknown");
      return threadId;
    });
    return json({ ...outcome.result, threadId: savedId });
  } catch (err) {
    console.error("copilot osint failed", err instanceof Error ? err.message : "unknown");
    await audit("FAILURE", { competitorId: parsed.data.competitorId, reason: "exception" });
    return json({ error: "L'analyse OSINT est momentanément indisponible. Réessayez dans un instant." }, 502);
  }
}
