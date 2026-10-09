import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@/core/domain/rbac/role";
import { localParts } from "@/core/domain/attendance/policy";
import { effectiveStatus } from "@/core/domain/finance/billing";
import { formatMoney } from "@/core/domain/finance/money";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { STATUS_LABELS, WEEKDAYS } from "@/core/domain/students/student";
import { listLevels } from "@/infrastructure/db/levels";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { STATUS_TONES } from "../status-tones";
import { EditForm } from "./edit-form";
import { Timetable, type SlotView } from "./timetable";

const INVOICE_VIEW = {
  PAID: { label: "Payée", tone: "success" },
  PARTIAL: { label: "Partielle", tone: "info" },
  PENDING: { label: "Impayée", tone: "warning" },
  OVERDUE: { label: "En retard", tone: "danger" },
} as const;

const ATT_LABELS = { PRESENT: "Présent", ABSENT: "Absent", LATE: "Retard" } as const;
const ATT_TONES = { PRESENT: "success", ABSENT: "danger", LATE: "warning" } as const;

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink/70">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const principal = await requirePagePermission("user:manage");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const db = tenantPrisma(principal);
  const showFinance = can(principal.role, "finance:read");
  const currency = await getSchoolCurrency(principal.schoolId);

  const student = await db.user.findFirst({
    where: { id: id.data, role: "STUDENT", deletedAt: null },
    include: {
      profile: true,
      parents: { orderBy: { position: "asc" } },
      attendances: { orderBy: { date: "desc" }, take: 30 },
      enrollments: { include: { course: true } },
      invoices: showFinance ? { where: { deletedAt: null }, orderBy: { dueDate: "asc" } } : false,
      payments: { orderBy: { paidAt: "desc" }, take: 10 },
    },
  });
  if (!student) notFound();

  const { profile } = student;
  const todayDate = new Date(localParts(new Date()).date);
  const levelOptions = await listLevels(db);
  const [rawSlots, chapterRows, teachers] = await Promise.all([
    db.timetableSlot.findMany({
      where: { OR: [{ studentId: student.id }, ...(profile ? [{ level: profile.level, studentId: null }] : [])] },
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        curriculumChapter: { select: { position: true, title: true } },
      },
    }),
    profile
      ? db.curriculumChapter.findMany({ where: { level: profile.level }, orderBy: [{ subject: "asc" }, { position: "asc" }] })
      : [],
    db.user.findMany({
      where: { role: "TEACHER", deletedAt: null },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  const slots: SlotView[] = rawSlots.map((s) => ({
    id: s.id,
    weekday: s.weekday,
    startTime: s.startTime,
    endTime: s.endTime,
    subject: s.subject,
    room: s.room,
    teacherId: s.teacherId,
    teacherName: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
    scope: s.studentId ? "student" : "class",
    chapterId: s.curriculumChapterId,
    chapterLabel: s.curriculumChapter ? `Ch. ${s.curriculumChapter.position} · ${s.curriculumChapter.title}` : null,
  }));

  const present = student.attendances.filter((a) => a.status === "PRESENT").length;
  const rate = student.attendances.length ? Math.round((present / student.attendances.length) * 100) : null;

  return (
    <>
      <Link href="/students" className="mb-4 inline-block text-sm text-ink/70 hover:text-ink">← Élèves</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle title={`${student.firstName} ${student.lastName}`} subtitle={student.email} />
        {profile ? <Badge tone={STATUS_TONES[profile.status]}>{STATUS_LABELS[profile.status]}</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Informations</h2>
          {profile ? (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-4 text-sm">
                <Info label="Classe" value={profile.level} />
                <Info label="Matricule" value={profile.matricule ?? "—"} />
                <div className="col-span-2"><Info label="Adresse" value={profile.address} /></div>
              </dl>
              <ul className="mb-6 grid gap-2">
                {student.parents.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-lilac/10 px-4 py-3">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge tone="info">{p.relation}</Badge>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-ink/80">
                      {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{p.phone}</a> : null}
                      {p.email ? <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a> : null}
                    </p>
                  </li>
                ))}
              </ul>
              <details className="rounded-2xl bg-canvas/50 p-4">
                <summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  Modifier la fiche et les contacts
                </summary>
                <div className="mt-4">
                  <EditForm
                    id={student.id}
                    levels={levelOptions.map((l) => l.name)}
                    initial={{ level: profile.level, address: profile.address, status: profile.status }}
                    parents={student.parents.map((p) => ({
                      name: p.name, relation: p.relation, phone: p.phone ?? "", email: p.email ?? "",
                    }))}
                  />
                </div>
              </details>
            </>
          ) : (
            <p className="text-ink/70">Aucune fiche d&apos;inscription.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Séances</h2>
          <ul className="grid gap-2">
            {student.enrollments.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-2xl bg-sky/10 px-4 py-3">
                <span className="font-medium">{e.course.name}</span>
                <span className="text-sm text-ink/70">{WEEKDAYS[e.course.weekday - 1]} · {e.course.startTime}</span>
              </li>
            ))}
            {student.enrollments.length === 0 ? <li className="text-ink/70">Aucune séance.</li> : null}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold">Emploi du temps</h2>
          <Timetable
            studentId={student.id}
            level={profile?.level ?? null}
            slots={slots}
            chapters={chapterRows.map((c) => ({ id: c.id, label: `${c.subject} - Ch. ${c.position} : ${c.title}` }))}
            teachers={teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))}
          />
        </Card>

        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Présences</h2>
            {rate !== null ? <span className="text-sm text-ink/70">{rate} % sur {student.attendances.length} appels</span> : null}
          </div>
          <ul className="grid max-h-72 gap-2 overflow-y-auto">
            {student.attendances.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-2.5">
                <span className="tabular-nums">{a.date.toLocaleDateString("fr-FR")}</span>
                <Badge tone={ATT_TONES[a.status]}>{ATT_LABELS[a.status]}</Badge>
              </li>
            ))}
            {student.attendances.length === 0 ? <li className="text-ink/70">Aucun appel enregistré.</li> : null}
          </ul>
        </Card>

        {showFinance && student.invoices ? (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Paiements</h2>
              {can(principal.role, "finance:write") ? (
                <Link href={`/compta/pay?student=${student.id}`} className="rounded-2xl bg-mint/15 px-3 py-1.5 text-sm text-mint outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  Encaisser
                </Link>
              ) : null}
            </div>
            <ul className="grid gap-2">
              {student.invoices.map((inv) => {
                const status = effectiveStatus(inv, todayDate);
                const view = inv.carriedToInvoiceId ? { label: "Reporté", tone: "info" as const } : INVOICE_VIEW[status];
                return (
                  <li key={inv.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-mint/10 px-4 py-3 ${inv.carriedToInvoiceId ? "opacity-60" : ""}`}>
                    <div>
                      <p className="font-medium">{inv.label}</p>
                      <p className="text-xs text-ink/70">
                        Échéance {inv.dueDate.toLocaleDateString("fr-FR")} · payé {formatMoney(inv.paidCents, currency)} / {formatMoney(inv.amountCents, currency)}
                      </p>
                    </div>
                    <Badge tone={view.tone}>{view.label}</Badge>
                  </li>
                );
              })}
              {student.invoices.length === 0 ? <li className="text-ink/70">Aucune facture.</li> : null}
            </ul>
            {student.payments.length > 0 ? (
              <>
                <h3 className="mb-2 mt-5 text-sm font-medium text-ink/70">Reçus</h3>
                <ul className="grid gap-2">
                  {student.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-2xl bg-canvas px-4 py-2.5 text-sm">
                      <span>{p.paidAt.toLocaleDateString("fr-FR")} · {formatMoney(p.amountCents, currency)}</span>
                      <a href={`/compta/receipt/${p.id}`} className="rounded-2xl bg-sky/15 px-3 py-1.5 text-sky outline-none focus-visible:ring-2 focus-visible:ring-accent">
                        Reçu PDF
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  );
}
