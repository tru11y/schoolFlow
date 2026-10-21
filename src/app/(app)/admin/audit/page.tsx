import { prisma } from "@/infrastructure/db/prisma";
import { PrismaAuditRepository } from "@/infrastructure/audit/prisma-audit-repository";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";

const severityOf = (metadata: unknown): string =>
  typeof metadata === "object" && metadata !== null && "severity" in metadata ? String(metadata.severity) : "INFO";

/** Cancellation/edit reason and the author's name + email, recorded by the payment actions. */
function detailsOf(metadata: unknown): string | null {
  const input = typeof metadata === "object" && metadata !== null && "input" in metadata ? metadata.input : null;
  if (typeof input !== "object" || input === null) return null;
  const reason = "reason" in input && typeof input.reason === "string" ? `Motif : ${input.reason}` : null;
  const actor =
    "actor" in input && typeof input.actor === "object" && input.actor !== null && "name" in input.actor && "email" in input.actor
      ? `${String(input.actor.name)} <${String(input.actor.email)}>`
      : null;
  return [actor, reason].filter(Boolean).join(" · ") || null;
}

const TONES = { SUCCESS: "success", DENIED: "danger", FAILURE: "warning" } as const;

export default async function AuditPage() {
  const principal = await requirePagePermission("audit:read");
  const where = principal.role === "SUPER_ADMIN" ? {} : { schoolId: principal.schoolId };

  const [logs, integrity] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { seq: "desc" }, take: 100 }),
    new PrismaAuditRepository().verifyChain(),
  ]);

  return (
    <>
      <PageTitle title="Journal d'audit" subtitle="Append-only, chaîné par HMAC-SHA256" />
      <div className="mb-4">
        <Badge tone={integrity.valid ? "success" : "danger"}>
          {integrity.valid ? "Intégrité de la chaîne vérifiée" : `Chaîne altérée (${integrity.brokenAt})`}
        </Badge>
      </div>
      <Card className="overflow-x-auto p-2 sm:p-4">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Dernières entrées du journal d&apos;audit</caption>
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Action</th>
              <th scope="col" className="px-4 py-3 font-medium">Rôle</th>
              <th scope="col" className="px-4 py-3 font-medium">Ressource</th>
              <th scope="col" className="px-4 py-3 font-medium">Détails</th>
              <th scope="col" className="px-4 py-3 font-medium">IP</th>
              <th scope="col" className="px-4 py-3 font-medium">Sévérité</th>
              <th scope="col" className="px-4 py-3 font-medium">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-ink/10">
                <td className="px-4 py-3 tabular-nums">{l.createdAt.toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-3">{l.actorRole ?? "—"}</td>
                <td className="px-4 py-3">{l.resource}</td>
                <td className="px-4 py-3 text-xs">{detailsOf(l.metadata) ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{l.ip ?? "—"}</td>
                <td className="px-4 py-3">
                  {severityOf(l.metadata) === "WARNING" ? <Badge tone="warning">WARNING</Badge> : <span className="text-ink/60">INFO</span>}
                </td>
                <td className="px-4 py-3"><Badge tone={TONES[l.outcome]}>{l.outcome}</Badge></td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-ink/70">Aucune entrée.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
