import { localParts } from "@/core/domain/attendance/policy";
import { can } from "@/core/domain/rbac/role";
import { remaining } from "@/core/domain/finance/billing";
import { formatMoney } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requireAuth } from "@/presentation/auth/guards";
import { Card, PageTitle, StatCard } from "@/presentation/components/ui";

const todayUtc = () => new Date(localParts(new Date()).date);

export default async function DashboardPage() {
  const principal = await requireAuth();
  const db = tenantPrisma(principal);
  const showFinance = can(principal.role, "finance:read");
  const currency = await getSchoolCurrency(principal.schoolId);

  const [students, present, recorded, homeworks, pending] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", deletedAt: null } }),
    db.attendanceRecord.count({ where: { date: todayUtc(), status: "PRESENT" } }),
    db.attendanceRecord.count({ where: { date: todayUtc() } }),
    db.homework.count(),
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
        <StatCard index={2} icon="📓" tone="lilac" label="Notes au cahier de texte" value={String(homeworks)} />
        {pending ? (
          <StatCard index={3} icon="💳" tone="mint" label="Impayés" value={formatMoney(pending.reduce((sum, i) => sum + remaining(i), 0), currency)} />
        ) : null}
      </div>
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
