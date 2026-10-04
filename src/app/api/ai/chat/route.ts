import { z } from "zod";
import { CHAT_FAILURE_REPLY } from "@/core/domain/copilot/chat-merge";
import { can } from "@/core/domain/rbac/role";
import { container } from "@/presentation/auth/container";
import { getPrincipal } from "@/presentation/auth/guards";
import { replyTo } from "@/infrastructure/copilot/chat-service";

/** The model call is capped at 20 s: stay well inside this. */
export const maxDuration = 30;

const body = z.object({ question: z.string().trim().min(2).max(300) });

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

/**
 * Copilot chat. Access follows the role (`copilot:use`, held by SUPER_ADMIN only), never an e-mail address.
 * Any failure on our side still answers with a readable message: the UI must never wait forever.
 */
export async function POST(req: Request) {
  // Cookie auth + JSON: reject cross-origin browser calls outright.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return json({ error: "Requête refusée." }, 403);

  const principal = await getPrincipal();
  if (!principal) return json({ error: "Session expirée. Reconnectez-vous puis réessayez." }, 401);

  const audit = (outcome: "SUCCESS" | "DENIED" | "FAILURE", metadata: unknown) =>
    container().audit.record({
      schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
      action: "COPILOT_ASKED", resource: "copilot", resourceId: null, outcome,
      ip: clientIp(req), userAgent: req.headers.get("user-agent"), metadata,
    });

  if (!can(principal.role, "copilot:use") || !principal.schoolId) {
    await audit("DENIED", { reason: "copilot:use" });
    return json({ error: "Le Copilote IA est réservé au SuperAdmin." }, 403);
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Question invalide (2 à 300 caractères)." }, 400);

  try {
    const reply = await replyTo(principal, parsed.data.question);
    // The question may name students or parents: only the detected intent is logged.
    await audit("SUCCESS", { intent: reply.intent });
    return json(reply);
  } catch (err) {
    console.error("copilot chat failed", err instanceof Error ? err.message : "unknown");
    await audit("FAILURE", { reason: "exception" });
    return json(CHAT_FAILURE_REPLY);
  }
}
