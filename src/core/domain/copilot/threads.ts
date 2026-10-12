import { z } from "zod";

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

export const MAX_TITLE = 80;

/** Title of a new conversation: the first question, collapsed and cut on a word boundary. */
export function titleFrom(question: string, max = 60): string {
  const flat = question.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat || "Nouvelle conversation";
  const cut = flat.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`;
}

export const threadTitleSchema = z.string().trim().min(1).max(MAX_TITLE);

export type AgeGroup = "Aujourd'hui" | "Hier" | "7 derniers jours" | "30 derniers jours" | "Plus ancien";
const ORDER: AgeGroup[] = ["Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours", "Plus ancien"];

/** Calendar days between two instants, in the given IANA timezone. */
function dayDiff(now: Date, then: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const day = (d: Date) => Date.parse(fmt.format(d));
  return Math.round((day(now) - day(then)) / 86_400_000);
}

/** Threads grouped by age (Aujourd'hui, Hier, ...), most recent first, empty groups omitted. */
export function groupThreadsByAge(threads: ThreadSummary[], now: Date, tz = "Europe/Paris"): { label: AgeGroup; threads: ThreadSummary[] }[] {
  const buckets = new Map<AgeGroup, ThreadSummary[]>();
  for (const t of [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    const diff = dayDiff(now, t.updatedAt, tz);
    const label: AgeGroup = diff <= 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : diff <= 7 ? "7 derniers jours" : diff <= 30 ? "30 derniers jours" : "Plus ancien";
    buckets.set(label, [...(buckets.get(label) ?? []), t]);
  }
  return ORDER.flatMap((label) => (buckets.has(label) ? [{ label, threads: buckets.get(label)! }] : []));
}
