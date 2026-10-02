import type { Role } from "./role";

/** Only a SuperAdmin may create, edit, deactivate or promote to SuperAdmin; everyone else is limited to lower roles. */
export function canManageRole(actor: Role, target: Role): boolean {
  return actor === "SUPER_ADMIN" || target !== "SUPER_ADMIN";
}

/** Students keep a profile / parents / invoices, so their role is not switchable after creation. */
export const SWITCHABLE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "PARENT"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  SCHOOL_ADMIN: "Direction",
  ACCOUNTANT: "Comptable",
  TEACHER: "Professeur",
  STUDENT: "Élève",
  PARENT: "Parent",
};

/** "Marc Dubois" -> first = "Marc", last = "Dubois". Needs at least two words. */
export function splitFullName(full: string): { firstName: string; lastName: string } | null {
  const [firstName, ...rest] = full.trim().split(/\s+/);
  const lastName = rest.join(" ");
  return firstName && lastName ? { firstName, lastName } : null;
}
