export const ENROLLMENT_STATUSES = ["ACTIVE", "PENDING", "ARCHIVED"] as const;
export type EnrollmentStatusValue = (typeof ENROLLMENT_STATUSES)[number];

export const STATUS_LABELS: Record<EnrollmentStatusValue, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  ARCHIVED: "Archivé",
};

export const LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"] as const;

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

/** Splits a payment plan into `count` monthly invoices; the first absorbs the rounding remainder. */
export function buildSchedule(totalCents: number, count: number, firstDue: Date): { amountCents: number; dueDate: Date }[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => {
    const dueDate = new Date(firstDue);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
    return { amountCents: base + (i === 0 ? remainder : 0), dueDate };
  });
}
