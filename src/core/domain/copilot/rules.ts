import { formatMoney } from "../finance/money";
import type {
  ActionCard, ActionLink, Contact, CopilotSnapshot, LevelSize, StudentAbsenceFlag, StudentArrear, TeacherPunctuality,
} from "./types";

export const ABSENCE_THRESHOLD = 2;
export const MIN_LEVEL_SIZE = 8;

const digits = (phone: string) => phone.replace(/[^\d]/g, "");

/** One-click channels for a ready-to-send message. Nothing is sent by the server. */
export function contactLinks(parent: Contact | null, text: string, subject: string): ActionLink[] {
  if (!parent) return [];
  const links: ActionLink[] = [];
  if (parent.phone) {
    links.push({ label: "WhatsApp", kind: "whatsapp", href: `https://wa.me/${digits(parent.phone)}?text=${encodeURIComponent(text)}` });
    links.push({ label: "SMS", kind: "sms", href: `sms:${parent.phone.replace(/\s/g, "")}?body=${encodeURIComponent(text)}` });
  }
  if (parent.email) {
    links.push({ label: "E-mail", kind: "email", href: `mailto:${parent.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}` });
  }
  return links;
}

const firstName = (full: string) => full.split(" ")[0] ?? full;

export const arrearsMessage = (a: StudentArrear, school: string, currency: string): string =>
  `Bonjour ${a.parent?.name ?? ""}, reliquat de ${formatMoney(a.owedCents, currency)} pour ${firstName(a.studentName)} (${a.level}). ` +
  `Merci de régulariser auprès de ${school} dès que possible. Nous restons disponibles pour toute question.`;

export const upcomingMessage = (a: StudentArrear, school: string, currency: string): string =>
  `Bonjour ${a.parent?.name ?? ""}, rappel : ${formatMoney(a.owedCents, currency)} sont à régler pour ${firstName(a.studentName)} ` +
  `avant le ${a.oldestDue.toLocaleDateString("fr-FR", { timeZone: "UTC" })}. ${school}.`;

export const absenceMessage = (f: StudentAbsenceFlag, school: string): string =>
  `Bonjour ${f.parent?.name ?? ""}, ${firstName(f.studentName)} (${f.level}) compte ${f.absences} absence(s) et ${f.lates} retard(s) cette semaine. ` +
  `Merci de nous contacter pour faire le point. ${school}.`;

interface InvoiceLike {
  studentId: string;
  amountCents: number;
  paidCents: number;
  dueDate: Date;
}

type Balances = Map<string, { owed: number; oldest: Date }>;

/** Sums the unpaid balance per student, split between overdue invoices and invoices due within `windowDays`. */
export function splitBalances(invoices: InvoiceLike[], now: Date, windowDays = 3): { overdue: Balances; upcoming: Balances } {
  const overdue: Balances = new Map();
  const upcoming: Balances = new Map();
  const horizon = now.getTime() + windowDays * 86_400_000;
  for (const i of invoices) {
    const owed = Math.max(0, i.amountCents - i.paidCents);
    if (owed === 0) continue;
    const bucket = i.dueDate.getTime() < now.getTime() ? overdue : i.dueDate.getTime() <= horizon ? upcoming : null;
    if (!bucket) continue;
    const prev = bucket.get(i.studentId);
    bucket.set(i.studentId, { owed: (prev?.owed ?? 0) + owed, oldest: prev && prev.oldest < i.dueDate ? prev.oldest : i.dueDate });
  }
  return { overdue, upcoming };
}

/** Students with strictly more than `threshold` absences + lates over the period. */
export function flagAbsentees(
  records: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" }[],
  threshold = ABSENCE_THRESHOLD,
): Map<string, { absences: number; lates: number }> {
  const counts = new Map<string, { absences: number; lates: number }>();
  for (const r of records) {
    if (r.status === "PRESENT") continue;
    const c = counts.get(r.studentId) ?? { absences: 0, lates: 0 };
    if (r.status === "ABSENT") c.absences++;
    else c.lates++;
    counts.set(r.studentId, c);
  }
  for (const [id, c] of counts) if (c.absences + c.lates <= threshold) counts.delete(id);
  return counts;
}

/** Share of possible faults (missed or late roll call, missing logbook) over expected sessions, 0..1. */
export const teacherFaultRate = (t: TeacherPunctuality): number =>
  t.expectedSessions === 0 ? 0 : Math.min(1, (t.missedRollCalls + t.lateRollCalls + t.missingLogbook) / (t.expectedSessions * 3));

export const rankTeachers = (teachers: TeacherPunctuality[]): TeacherPunctuality[] =>
  teachers
    .filter((t) => t.missedRollCalls + t.lateRollCalls + t.missingLogbook > 0)
    .sort((a, b) => teacherFaultRate(b) - teacherFaultRate(a) || a.teacherName.localeCompare(b.teacherName));

export const underStaffed = (levels: LevelSize[], min = MIN_LEVEL_SIZE): LevelSize[] =>
  levels.filter((l) => l.students < min).sort((a, b) => a.students - b.students);

export function buildActionCards(s: CopilotSnapshot): ActionCard[] {
  const cards: ActionCard[] = [];
  const money = (c: number) => formatMoney(c, s.currency);

  if (s.arrears.length > 0) {
    const total = s.arrears.reduce((n, a) => n + a.owedCents, 0);
    cards.push({
      id: "arrears", category: "FINANCE", priority: 1,
      title: `${s.arrears.length} élève(s) en retard de paiement`,
      detail: `${money(total)} à recouvrer. Les relances sont prêtes à envoyer.`,
      links: [{ label: "Voir les relances", kind: "page", href: "/ai-assistant?q=arri%C3%A9r%C3%A9s" }],
    });
  }
  if (s.upcoming.length > 0) {
    cards.push({
      id: "upcoming", category: "FINANCE", priority: 2,
      title: `${s.upcoming.length} échéance(s) dans les 3 jours`,
      detail: "Un rappel préventif réduit les impayés.",
      links: [{ label: "Voir les rappels", kind: "page", href: "/ai-assistant?q=%C3%A9ch%C3%A9ances" }],
    });
  }
  if (s.absences.length > 0) {
    cards.push({
      id: "absences", category: "DISCIPLINE", priority: 1,
      title: `${s.absences.length} élève(s) non assidus cette semaine`,
      detail: `Plus de ${ABSENCE_THRESHOLD} absences ou retards. Prévenez les parents.`,
      links: [{ label: "Notifier les parents", kind: "page", href: "/ai-assistant?q=absences" }],
    });
  }
  const ranked = rankTeachers(s.teachers);
  if (ranked.length > 0) {
    const worst = ranked[0]!;
    cards.push({
      id: "teachers", category: "PEDAGOGY", priority: 2,
      title: `${ranked.length} professeur(s) avec des manquements`,
      detail: `${worst.teacherName} : ${worst.missedRollCalls} appel(s) manqué(s), ${worst.lateRollCalls} en retard, ${worst.missingLogbook} cahier(s) non rempli(s).`,
      links: [{ label: "Rapport de ponctualité", kind: "page", href: "/ai-assistant?q=profs" }],
    });
  }
  const small = underStaffed(s.levels);
  if (small.length > 0) {
    cards.push({
      id: "growth", category: "GROWTH", priority: 3,
      title: `${small.length} classe(s) sous-effectif`,
      detail: `${small.map((l) => `${l.level} (${l.students})`).join(", ")}. Lancez parrainage ou réduction fratrie.`,
      links: [{ label: "Idées de campagne", kind: "page", href: "/ai-assistant?q=effectif" }],
    });
  }
  return cards.sort((a, b) => a.priority - b.priority);
}
