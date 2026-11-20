import Link from "next/link";
import { localParts } from "@/core/domain/attendance/policy";
import { can } from "@/core/domain/rbac/role";
import type { Principal } from "@/core/domain/auth/principal";
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
import { Badge, Card, MiniBars, PageTitle, StatCard } from "@/presentation/components/ui";

const todayUtc = () => new Date(localParts(new Date()).date);
const DAY_MS = 86_400_000;
const WEEKDAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const hhmm = (t: string) => t.replace(":", "h");

function Shortcuts({ items }: { items: { href: string; label: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">Raccourcis</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-sm font-medium shadow-soft ring-1 ring-ink/5 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Recommended({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">Actions recommandées</h2>
      <ul className="grid gap-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-center gap-2 rounded-2xl bg-canvas px-4 py-3 text-sm">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden /> {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function DashboardPage() {
  const principal = await requireAuth();
  if (can(principal.role, "user:manage")) return <ManagementOverview principal={principal} />;
  if (principal.role === "TEACHER") return <TeacherOverview principal={principal} />;
  if (principal.role === "ACCOUNTANT") return <AccountantOverview principal={principal} />;
  if (principal.role === "PARENT") return <ParentOverview principal={principal} />;
  return <StudentOverview principal={principal} />;
}

/** Direction / super admin: établissement complet. */
async function ManagementOverview({ principal }: { principal: Principal }) {
  const db = tenantPrisma(principal);
  const showFinance = can(principal.role, "finance:read");
  const currency = await getSchoolCurrency(principal.schoolId);
  const copilot =
    can(principal.role, "copilot:use") && principal.schoolId
      ? await Promise.all([loadSnapshot(principal), loadGrowth(principal)]).then(async ([snapshot, growth]) => ({
          cards: buildActionCards(snapshot),
          roi: topRoiActions(snapshot, buildInsights(growth), 3),
          currency: snapshot.currency,
          summary: await db.aiReport
            .findFirst({ where: { scope: "school", day: todayUtc() }, select: { content: true, model: true } })
            .then((r) => (r ? { text: r.content, source: "cache" as const, model: r.model } : null)),
        }))
      : null;

  const today = todayUtc();
  const weekStart = new Date(today.getTime() - 6 * DAY_MS);
  const [students, present, recorded, homeworks, pending, weekRecords] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", deletedAt: null } }),
    db.attendanceRecord.count({ where: { date: today, status: "PRESENT" } }),
    db.attendanceRecord.count({ where: { date: today } }),
    db.logbookEntry.count({ where: { deletedAt: null } }),
    showFinance
      ? db.invoice.findMany({ where: { deletedAt: null, carriedToInvoiceId: null }, select: { amountCents: true, paidCents: true } })
      : null,
    db.attendanceRecord.findMany({ where: { date: { gte: weekStart, lte: today } }, select: { date: true, status: true } }),
  ]);

  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * DAY_MS);
    const key = d.getTime();
    const day = weekRecords.filter((r) => r.date.getTime() === key);
    const total = day.length;
    const rate = total === 0 ? 0 : Math.round((day.filter((r) => r.status === "PRESENT").length / total) * 100);
    return { label: WEEKDAYS[d.getUTCDay()] ?? "", value: rate };
  });
  const hasAttendance = trend.some((d) => d.value > 0);

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Vue d'ensemble de votre établissement" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} icon="graduation" tone="sky" label="Élèves inscrits" value={String(students)} />
        <StatCard
          index={1}
          icon="hand"
          tone="peach"
          label="Taux de présence du jour"
          value={recorded === 0 ? "—" : `${Math.round((present / recorded) * 100)} %`}
          hint={recorded === 0 ? "Aucun appel aujourd'hui" : `${present}/${recorded} présents`}
        />
        <StatCard index={2} icon="book" tone="lilac" label="Séances au cahier de texte" value={String(homeworks)} />
        {pending ? (
          <StatCard index={3} icon="card" tone="mint" label="Impayés" value={formatMoney(pending.reduce((sum, i) => sum + remaining(i), 0), currency)} />
        ) : null}
      </div>

      {showFinance || hasAttendance ? (
        <Card className="mt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Présence des 7 derniers jours</h2>
            <span className="text-xs text-ink/50">taux quotidien (%)</span>
          </div>
          {hasAttendance ? (
            <MiniBars data={trend} tone="peach" />
          ) : (
            <p className="py-8 text-center text-sm text-ink/60">Aucun appel enregistré cette semaine.</p>
          )}
        </Card>
      ) : null}
      {copilot ? <RoiPanel actions={copilot.roi} currency={copilot.currency} /> : null}
      {copilot ? (
        <div className="mt-6">
          <SummaryCard title="✨ Analyse enrichie du jour" scopes={[{ value: "school", label: "Toute l'école" }]} initial={copilot.summary} />
        </div>
      ) : null}
      {copilot ? <TodayPanel cards={copilot.cards} /> : null}
      <Shortcuts
        items={[
          { href: "/students", label: "Élèves" },
          { href: "/absences", label: "Absences" },
          { href: "/compta", label: "Comptabilité" },
          { href: "/admin/users", label: "Utilisateurs" },
          { href: "/admin/timetable", label: "Emploi du temps" },
        ]}
      />
    </>
  );
}

/** Professeur : uniquement ses cours, ses appels et son cahier de texte du jour. */
async function TeacherOverview({ principal }: { principal: Principal }) {
  const db = tenantPrisma(principal);
  const { weekday } = localParts(new Date());
  const today = todayUtc();
  const slots = await db.timetableSlot.findMany({
    where: { teacherId: principal.userId, weekday },
    orderBy: { startTime: "asc" },
    select: { id: true, subject: true, level: true, startTime: true, endTime: true, room: true },
  });
  const slotIds = slots.map((s) => s.id);
  const [sessions, logs] = await Promise.all([
    slotIds.length ? db.attendanceSession.findMany({ where: { date: today, slotId: { in: slotIds }, deletedAt: null }, select: { slotId: true } }) : [],
    slotIds.length ? db.logbookEntry.findMany({ where: { date: today, slotId: { in: slotIds }, deletedAt: null }, select: { slotId: true } }) : [],
  ]);
  const called = new Set(sessions.map((s) => s.slotId));
  const logged = new Set(logs.map((l) => l.slotId));
  const toCall = slots.filter((s) => !called.has(s.id)).length;
  const toLog = slots.filter((s) => !logged.has(s.id)).length;
  const dateIso = today.toISOString().slice(0, 10);
  const reco = [
    ...(toCall > 0 ? [`${toCall} appel${toCall > 1 ? "s" : ""} à faire aujourd'hui`] : []),
    ...(toLog > 0 ? [`${toLog} séance${toLog > 1 ? "s" : ""} à consigner au cahier de texte`] : []),
    ...(slots.length > 0 && toCall === 0 && toLog === 0 ? ["Tout est à jour pour aujourd'hui 🎉"] : []),
  ];

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Vos cours et appels du jour" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} icon="clock" tone="sky" label="Cours aujourd'hui" value={String(slots.length)} />
        <StatCard index={1} icon="hand" tone="peach" label="Appels à faire" value={String(toCall)} hint={toCall === 0 ? "Tout est à jour" : undefined} />
        <StatCard index={2} icon="book" tone="lilac" label="Cahier à remplir" value={String(toLog)} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Vos cours du jour</h2>
        <ul className="grid gap-2">
          {slots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
              <div>
                <p className="font-medium">
                  {s.subject} · {s.level}
                  {s.room ? <span className="text-ink/50"> · {s.room}</span> : null}
                </p>
                <p className="text-xs text-ink/70 tabular-nums">{hhmm(s.startTime)}–{hhmm(s.endTime)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {called.has(s.id) ? (
                  <Badge tone="success">Appel fait</Badge>
                ) : (
                  <Link href={`/absences/take?level=${encodeURIComponent(s.level ?? "")}`} className="rounded-xl bg-peach/15 px-3 py-1 text-xs text-peach outline-none hover:bg-peach/25 focus-visible:ring-2 focus-visible:ring-accent">
                    Faire l&apos;appel
                  </Link>
                )}
                {logged.has(s.id) ? (
                  <Badge tone="success">Cahier rempli</Badge>
                ) : (
                  <Link
                    href={`/cahier-de-texte?${new URLSearchParams({ new: "1", level: s.level ?? "", subject: s.subject, date: dateIso, slot: s.id })}`}
                    className="rounded-xl bg-lilac/15 px-3 py-1 text-xs text-lilac outline-none hover:bg-lilac/25 focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Remplir le cahier
                  </Link>
                )}
              </div>
            </li>
          ))}
          {slots.length === 0 ? <li className="py-6 text-center text-sm text-ink/60">Aucun cours programmé aujourd&apos;hui.</li> : null}
        </ul>
      </Card>
      <Recommended items={reco} />
      <Shortcuts
        items={[
          { href: "/absences/take", label: "Faire l'appel" },
          { href: "/cahier-de-texte", label: "Cahier de texte" },
          { href: "/absences", label: "Absences" },
          { href: "/curriculum", label: "Programmes" },
        ]}
      />
    </>
  );
}

/** Comptable : impayés et encaissements, rien de pédagogique. */
async function AccountantOverview({ principal }: { principal: Principal }) {
  const db = tenantPrisma(principal);
  const currency = await getSchoolCurrency(principal.schoolId);
  const today = todayUtc();
  const [open, todayPayments] = await Promise.all([
    db.invoice.findMany({ where: { deletedAt: null, carriedToInvoiceId: null }, select: { amountCents: true, paidCents: true } }),
    db.payment.findMany({ where: { deletedAt: null, paidAt: { gte: today } }, select: { amountCents: true } }),
  ]);
  const unpaid = open.reduce((sum, i) => sum + remaining(i), 0);
  const unpaidCount = open.filter((i) => remaining(i) > 0).length;
  const cashedToday = todayPayments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Suivi des paiements" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} icon="card" tone="peach" label="Impayés" value={formatMoney(unpaid, currency)} hint={`${unpaidCount} facture${unpaidCount > 1 ? "s" : ""}`} />
        <StatCard index={1} icon="wallet" tone="mint" label="Encaissé aujourd'hui" value={formatMoney(cashedToday, currency)} hint={`${todayPayments.length} paiement${todayPayments.length > 1 ? "s" : ""}`} />
        <StatCard index={2} icon="receipt" tone="sky" label="Reçus du jour" value={String(todayPayments.length)} />
      </div>
      <Recommended items={unpaidCount > 0 ? [`${unpaidCount} facture${unpaidCount > 1 ? "s" : ""} impayée${unpaidCount > 1 ? "s" : ""} à relancer`] : ["Aucun impayé en attente 🎉"]} />
      <Shortcuts
        items={[
          { href: "/compta/pay", label: "Encaisser un paiement" },
          { href: "/compta", label: "Comptabilité" },
        ]}
      />
    </>
  );
}

/** Élève : sa propre assiduité et ses devoirs à venir. */
async function StudentOverview({ principal }: { principal: Principal }) {
  const db = tenantPrisma(principal);
  const today = todayUtc();
  const profile = await db.studentProfile.findUnique({ where: { userId: principal.userId }, select: { level: true } });
  const level = profile?.level ?? null;
  const [records, homework] = await Promise.all([
    db.attendanceRecord.findMany({ where: { studentId: principal.userId }, orderBy: { date: "desc" }, take: 60, select: { status: true } }),
    level
      ? db.logbookEntry.findMany({
          where: { level, deletedAt: null, homework: { not: null }, homeworkDue: { gte: today } },
          orderBy: { homeworkDue: "asc" },
          take: 6,
          select: { id: true, subject: true, homework: true, homeworkDue: true },
        })
      : [],
  ]);
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const rate = records.length === 0 ? "—" : `${Math.round((present / records.length) * 100)} %`;

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Votre assiduité et vos devoirs" />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard index={0} icon="hand" tone="peach" label="Taux de présence" value={rate} hint={records.length ? `sur ${records.length} appels` : undefined} />
        <StatCard index={1} icon="clock" tone="sky" label="Absences" value={String(absent)} />
        <StatCard index={2} icon="book" tone="lilac" label="Devoirs à venir" value={String(homework.length)} />
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Prochains devoirs</h2>
        <ul className="grid gap-2">
          {homework.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
              <div>
                <p className="font-medium">{h.subject}</p>
                <p className="text-xs text-ink/70">{h.homework}</p>
              </div>
              {h.homeworkDue ? <Badge tone="warning">{h.homeworkDue.toLocaleDateString("fr-FR")}</Badge> : null}
            </li>
          ))}
          {homework.length === 0 ? <li className="py-6 text-center text-sm text-ink/60">Aucun devoir à rendre pour le moment.</li> : null}
        </ul>
      </Card>
      <Recommended
        items={[
          ...(homework.length > 0 ? [`${homework.length} devoir${homework.length > 1 ? "s" : ""} à préparer`] : []),
          ...(absent > 0 ? [`${absent} absence${absent > 1 ? "s" : ""} à justifier auprès de l'école`] : []),
        ]}
      />
      <Shortcuts
        items={[
          { href: "/absences", label: "Mes absences" },
          { href: "/cahier-de-texte", label: "Cahier de texte" },
        ]}
      />
    </>
  );
}

/** Parent : assiduité et impayés de ses enfants uniquement. */
async function ParentOverview({ principal }: { principal: Principal }) {
  const db = tenantPrisma(principal);
  const currency = await getSchoolCurrency(principal.schoolId);
  const links = await db.guardianLink.findMany({
    where: { parentId: principal.userId },
    select: { student: { select: { id: true, firstName: true, lastName: true } } },
  });
  const children = links.map((l) => l.student);
  const childIds = children.map((c) => c.id);
  const [records, invoices] = await Promise.all([
    childIds.length
      ? db.attendanceRecord.findMany({ where: { studentId: { in: childIds } }, orderBy: { date: "desc" }, take: 200, select: { studentId: true, status: true } })
      : [],
    childIds.length
      ? db.invoice.findMany({ where: { studentId: { in: childIds }, deletedAt: null, carriedToInvoiceId: null }, select: { studentId: true, amountCents: true, paidCents: true } })
      : [],
  ]);

  const perChild = children.map((c) => {
    const recs = records.filter((r) => r.studentId === c.id);
    const present = recs.filter((r) => r.status === "PRESENT").length;
    const due = invoices.filter((i) => i.studentId === c.id).reduce((sum, i) => sum + remaining(i), 0);
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      rate: recs.length === 0 ? "—" : `${Math.round((present / recs.length) * 100)} %`,
      due,
    };
  });
  const totalDue = perChild.reduce((sum, c) => sum + c.due, 0);

  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Le suivi de vos enfants" />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard index={0} icon="graduation" tone="sky" label="Enfants suivis" value={String(children.length)} />
        <StatCard index={1} icon="card" tone="peach" label="Solde à régler" value={formatMoney(totalDue, currency)} />
      </div>
      <Card className="mt-6">
        <h2 className="mb-4 text-lg font-semibold">Vos enfants</h2>
        <ul className="grid gap-2">
          {perChild.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
              <p className="font-medium">{c.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">Présence {c.rate}</Badge>
                {c.due > 0 ? <Badge tone="danger">{formatMoney(c.due, currency)} dû</Badge> : <Badge tone="success">À jour</Badge>}
              </div>
            </li>
          ))}
          {children.length === 0 ? <li className="py-6 text-center text-sm text-ink/60">Aucun enfant rattaché à votre compte.</li> : null}
        </ul>
      </Card>
      <Recommended items={totalDue > 0 ? [`Régler le solde de ${formatMoney(totalDue, currency)}`] : []} />
      <Shortcuts
        items={[
          { href: "/compta", label: "Paiements" },
          { href: "/absences", label: "Absences" },
          { href: "/cahier-de-texte", label: "Cahier de texte" },
        ]}
      />
    </>
  );
}
