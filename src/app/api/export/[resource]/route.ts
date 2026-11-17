import { localParts } from "@/core/domain/attendance/policy";
import { effectiveStatus, remaining } from "@/core/domain/finance/billing";
import { formatMoney } from "@/core/domain/finance/money";
import { ForbiddenError } from "@/core/domain/errors";
import { toCsv } from "@/core/domain/export/csv";
import { ROLES, type Permission, type Role } from "@/core/domain/rbac/role";
import { ROLE_LABELS } from "@/core/domain/rbac/user-management";
import { ENROLLMENT_STATUSES, STATUS_LABELS, type EnrollmentStatusValue } from "@/core/domain/students/student";
import { WEEKDAY_LABELS } from "@/core/domain/timetable/import";
import { prisma } from "@/infrastructure/db/prisma";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { container } from "@/presentation/auth/container";
import { requirePermission } from "@/presentation/auth/guards";
import type { Principal } from "@/core/domain/auth/principal";

type Db = ReturnType<typeof tenantPrisma>;
interface Sheet {
  headers: string[];
  rows: unknown[][];
}
interface Resource {
  permission: Permission;
  build: (db: Db, principal: Principal, params: URLSearchParams) => Promise<Sheet>;
}

const INVOICE_STATUS = { PAID: "Payée", PARTIAL: "Partielle", PENDING: "Impayée", OVERDUE: "En retard" } as const;
const METHOD = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", TRANSFER: "Virement", CHEQUE: "Chèque" } as const;
const ATTENDANCE = { PRESENT: "Présent", ABSENT: "Absent", LATE: "Retard" } as const;

const isStatus = (v: string | undefined): v is EnrollmentStatusValue => ENROLLMENT_STATUSES.some((s) => s === v);
const isRole = (v: string | undefined): v is Role => ROLES.some((r) => r === v);
const severityOf = (m: unknown): string =>
  typeof m === "object" && m !== null && "severity" in m ? String((m as { severity: unknown }).severity) : "INFO";

const RESOURCES: Record<string, Resource> = {
  students: {
    permission: "user:manage",
    async build(db, principal, params) {
      const status = params.get("status") ?? undefined;
      const level = params.get("level") ?? undefined;
      const query = params.get("q")?.trim().slice(0, 80);
      const profile = { ...(level ? { level } : {}), ...(isStatus(status) ? { status } : {}) };
      const students = await db.user.findMany({
        where: {
          role: "STUDENT",
          deletedAt: null,
          ...(Object.keys(profile).length ? { profile } : {}),
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" as const } },
                  { lastName: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: { lastName: "asc" },
        select: {
          firstName: true, lastName: true, email: true, createdAt: true,
          profile: { select: { level: true, status: true, monthlyFeeCents: true } },
        },
      });
      const currency = await getSchoolCurrency(principal.schoolId);
      return {
        headers: ["Nom", "Prénom", "E-mail", "Classe", "Statut", "Mensualité", "Inscrit le"],
        rows: students.map((s) => [
          s.lastName, s.firstName, s.email, s.profile?.level ?? "",
          s.profile ? STATUS_LABELS[s.profile.status] : "",
          s.profile?.monthlyFeeCents != null ? formatMoney(s.profile.monthlyFeeCents, currency, "code") : "Tarif classe",
          s.createdAt,
        ]),
      };
    },
  },
  invoices: {
    permission: "finance:read",
    async build(db, principal) {
      const currency = await getSchoolCurrency(principal.schoolId);
      const today = new Date(localParts(new Date()).date);
      const invoices = await db.invoice.findMany({
        where: { deletedAt: null, carriedToInvoiceId: null },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      return {
        headers: ["Élève", "Libellé", "Échéance", "Montant dû", "Payé", "Reste", "Statut"],
        rows: invoices.map((inv) => [
          `${inv.student.lastName} ${inv.student.firstName}`, inv.label, inv.dueDate,
          formatMoney(inv.amountCents, currency, "code"),
          formatMoney(inv.paidCents, currency, "code"),
          formatMoney(remaining(inv), currency, "code"),
          INVOICE_STATUS[effectiveStatus(inv, today)],
        ]),
      };
    },
  },
  payments: {
    permission: "finance:read",
    async build(db, principal) {
      const currency = await getSchoolCurrency(principal.schoolId);
      const payments = await db.payment.findMany({
        where: { deletedAt: null },
        orderBy: { paidAt: "desc" },
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      return {
        headers: ["Date", "Élève", "Description", "Mode", "Montant", "Référence"],
        rows: payments.map((p) => [
          p.paidAt, `${p.student.lastName} ${p.student.firstName}`, p.description,
          METHOD[p.method], formatMoney(p.amountCents, currency, "code"), p.reference ?? p.id,
        ]),
      };
    },
  },
  attendance: {
    permission: "attendance:write",
    async build(db, _principal, params) {
      const level = params.get("level") ?? undefined;
      const records = await db.attendanceRecord.findMany({
        where: level ? { session: { level } } : {},
        orderBy: [{ date: "desc" }],
        include: {
          student: { select: { firstName: true, lastName: true } },
          session: { select: { level: true, subject: true } },
        },
      });
      return {
        headers: ["Date", "Élève", "Classe", "Matière", "Statut"],
        rows: records.map((r) => [
          r.date, `${r.student.lastName} ${r.student.firstName}`, r.session?.level ?? "",
          r.session?.subject ?? "", ATTENDANCE[r.status],
        ]),
      };
    },
  },
  curriculum: {
    permission: "homework:read",
    async build(db, _principal, params) {
      const level = params.get("level") ?? undefined;
      const chapters = await db.curriculumChapter.findMany({
        where: { deletedAt: null, ...(level ? { level } : {}) },
        orderBy: [{ level: "asc" }, { subject: "asc" }, { position: "asc" }],
      });
      return {
        headers: ["Classe", "Matière", "N°", "Chapitre", "Terminé", "Terminé le"],
        rows: chapters.map((c) => [
          c.level, c.subject, c.position, c.title, c.completedAt ? "Oui" : "Non", c.completedAt,
        ]),
      };
    },
  },
  users: {
    permission: "user:manage",
    async build(db, _principal, params) {
      const role = params.get("role") ?? undefined;
      const status = params.get("status") ?? undefined;
      const query = params.get("q")?.trim().slice(0, 80);
      const users = await db.user.findMany({
        where: {
          deletedAt: null,
          ...(isRole(role) ? { role } : {}),
          ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
          ...(query
            ? {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" as const } },
                  { lastName: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
        select: { firstName: true, lastName: true, email: true, phone: true, role: true, specialty: true, isActive: true, createdAt: true },
      });
      return {
        headers: ["Nom", "Prénom", "E-mail", "Téléphone", "Rôle", "Spécialité", "Statut", "Créé le"],
        rows: users.map((u) => [
          u.lastName, u.firstName, u.email, u.phone ?? "", ROLE_LABELS[u.role], u.specialty ?? "",
          u.isActive ? "Actif" : "Inactif", u.createdAt,
        ]),
      };
    },
  },
  timetable: {
    permission: "user:manage",
    async build(db, _principal, params) {
      const level = params.get("level") ?? undefined;
      const slots = await db.timetableSlot.findMany({
        where: { studentId: null, level: { not: null }, ...(level ? { level } : {}) },
        orderBy: [{ level: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
        include: { teacher: { select: { firstName: true, lastName: true } } },
      });
      // When empty, still return the header so the file serves as an import template.
      return {
        headers: ["Classe", "Jour", "Début", "Fin", "Matière", "Enseignant", "Salle"],
        rows: slots.map((s) => [
          s.level, WEEKDAY_LABELS[s.weekday - 1], s.startTime, s.endTime, s.subject,
          s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : "", s.room ?? "",
        ]),
      };
    },
  },
  audit: {
    permission: "audit:read",
    async build(_db, principal) {
      const logs = await prisma.auditLog.findMany({
        where: principal.role === "SUPER_ADMIN" ? {} : { schoolId: principal.schoolId },
        orderBy: { seq: "desc" },
        take: 5000,
      });
      return {
        headers: ["Date", "Action", "Rôle", "Ressource", "ID ressource", "Résultat", "Sévérité", "IP"],
        rows: logs.map((l) => [
          l.createdAt.toISOString(), l.action, l.actorRole ?? "", l.resource, l.resourceId ?? "",
          l.outcome, severityOf(l.metadata), l.ip ?? "",
        ]),
      };
    },
  },
  logbook: {
    permission: "homework:read",
    async build(db, _principal, params) {
      const level = params.get("level") ?? undefined;
      const subject = params.get("subject") ?? undefined;
      const entries = await db.logbookEntry.findMany({
        where: { deletedAt: null, ...(level ? { level } : {}), ...(subject ? { subject } : {}) },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        include: { teacher: { select: { firstName: true, lastName: true } } },
      });
      return {
        headers: ["Date", "Classe", "Matière", "Titre", "Contenu", "Devoirs", "À rendre le", "Enseignant"],
        rows: entries.map((e) => [
          e.date, e.level, e.subject, e.title, e.content, e.homework ?? "", e.homeworkDue,
          `${e.teacher.lastName} ${e.teacher.firstName}`,
        ]),
      };
    },
  },
};

export async function GET(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const name = (await params).resource;
  const resource = RESOURCES[name];
  if (!resource) return new Response("Not found", { status: 404 });

  let principal: Principal;
  try {
    principal = await requirePermission(resource.permission);
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw err;
  }

  const search = new URL(req.url).searchParams;
  const { headers, rows } = await resource.build(tenantPrisma(principal), principal, search);

  await container().audit.record({
    schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
    action: "data.export", resource: name, resourceId: `${rows.length} lignes`, outcome: "SUCCESS",
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: req.headers.get("user-agent"),
  });

  const date = localParts(new Date()).date;
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
