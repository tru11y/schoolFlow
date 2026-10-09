export const ENROLLMENT_STATUSES = ["ACTIVE", "PENDING", "ARCHIVED"] as const;
export type EnrollmentStatusValue = (typeof ENROLLMENT_STATUSES)[number];

export const STATUS_LABELS: Record<EnrollmentStatusValue, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  ARCHIVED: "Archivé",
};

export const LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"] as const;

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
