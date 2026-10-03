export interface Scope {
  level: string;
  subject: string;
}

/** A teacher may log lessons for the (class, subject) pairs they are scheduled for, plus class x specialty assignments. */
export function teacherScopes(
  slots: { level: string | null; subject: string }[],
  classLevels: string[],
  specialty: string | null,
): Scope[] {
  const out = new Map<string, Scope>();
  const add = (level: string, subject: string) => out.set(`${level}|${subject}`, { level, subject });
  for (const s of slots) if (s.level) add(s.level, s.subject);
  if (specialty) for (const level of classLevels) add(level, specialty);
  return [...out.values()];
}

export const canWriteScope = (scopes: Scope[], level: string, subject: string): boolean =>
  scopes.some((s) => s.level === level && s.subject === subject);

/** "Aujourd'hui" / "Hier" / "dd/mm/yyyy" for YYYY-MM-DD strings. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Aujourd'hui";
  const yesterday = new Date(new Date(`${today}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  if (date === yesterday) return "Hier";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

const hour = (hhmm: string) => {
  const [h = "0", m = "00"] = hhmm.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

/** "10h-12h", "8h30-10h" or "" when no times are known. */
export function timeRange(start?: string | null, end?: string | null): string {
  return start && end ? `${hour(start)}-${hour(end)}` : "";
}
