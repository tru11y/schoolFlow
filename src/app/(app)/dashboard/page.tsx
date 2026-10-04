import { localParts } from "@/core/domain/attendance/policy";
import { can } from "@/core/domain/rbac/role";
import { remaining } from "@/core/domain/finance/billing";
import { formatMoney } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requireAuth } from "@/presentation/auth/guards";
import { buildActionCards } from "@/core/domain/copilot/rules";
import { loadSnapshot } from "@/infrastructure/copilot/copilot-service";
import { buildInsights } from "@/core/domain/copilot/benchmark";
import { topRoiActions } from "@/core/domain/copilot/roi";
import { loadGrowth } from "@/infrastructure/copilot/growth-service";
import { RoiPanel, TodayPanel } from "@/presentation/components/copilot-cards";
import { SummaryCard } from "@/app/(app)/ai-assistant/growth/summary-card";
import { Card, PageTitle, StatCard } from "@/presentation/components/ui";

const todayUtc = () => new Date(localParts(new Date()).date);

export default async function DashboardPage() {
  const principal = await requireAuth();
  const db = tenantPrisma(principal);
  const showFinance = can(principal.role, "finance:read");
  const currency = await getSchoolCurrency(principal.schoolId);
  const copilot =
    can(principal.role, "copilot:use") && principal.schoolId
      ? await Promise.all([loadSnapshot(principal), loadGrowth(principal)]).then(async ([snapshot, growth]) => ({
          cards: buildActionCards(snapshot),
          roi: topRoiActions(snapshot, buildInsights(growth), 3),
          currency: snapshot.currency,
          // Today's cached model analysis, if any: showing it costs nothing.
          summary: await db.aiReport
            .findFirst({ where: { scope: "school", day: todayUtc() }, select: { content: true, model: true } })
            .then((r) => (r ? { text: r.content, source: "cache" as const, model: r.model } : null)),
        }))
      : null;

  const [students, present, recorded, homeworks, pending] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", deletedAt: null } }),
    db.attendanceRecord.count({ where: { date: todayUtc(), status: "PRESENT" } }),
    db.attendanceRecord.count({ where: { date: todayUtc() } }),
    db.logbookEntry.count(),
    showFinance
      ? db.invoice.findMany({ where: { deletedAt: null, carriedToInvoiceId: null }, select: { amountCents: true, paidCents: true } })
      : null,
  ]);

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Vue d'ensemble de votre établissement" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon="🎓" tone="sky" label="Élèves inscrits" value={String(students)} />
        <StatCard
          index={1}
          icon="🙋"
          tone="peach"
          label="Taux de présence du jour"
          value={recorded === 0 ? "—" : `${Math.round((present / recorded) * 100)} %`}
        />
        <StatCard index={2} icon="📓" tone="lilac" label="Séances au cahier de texte" value={String(homeworks)} />
        {pending ? (
          <StatCard index={3} icon="💳" tone="mint" label="Impayés" value={formatMoney(pending.reduce((sum, i) => sum + remaining(i), 0), currency)} />
        ) : null}
      </div>
      {copilot ? <RoiPanel actions={copilot.roi} currency={copilot.currency} /> : null}
      {copilot ? (
        <div className="mt-6">
          <SummaryCard
            title="✨ Analyse enrichie du jour"
            scopes={[{ value: "school", label: "Toute l'école" }]}
            initial={copilot.summary}
          />
        </div>
      ) : null}
      {copilot ? <TodayPanel cards={copilot.cards} /> : null}
      <Card className="mt-6">
        <h2 className="text-lg font-semibold">Bienvenue sur SchoolFlow</h2>
        <p className="mt-2 text-ink/70">
          Utilisez le menu pour suivre la comptabilité, faire l&apos;appel, rédiger le cahier de texte et consulter le
          journal d&apos;audit infalsifiable.
        </p>
      </Card>
    </>
  );
}
