import { formatMoney } from "../finance/money";
import type { Insight } from "./benchmark";
import type { CopilotSnapshot } from "./types";

/**
 * How likely the amount is to materialize. Money already owed is nearly certain; a recruitment or pricing
 * projection is a hypothesis, so it must not outrank a real receivable on the same size.
 */
export const ROI_CONFIDENCE = { recovery: 1, upcoming: 0.9, pricing: 0.6, pack: 0.8, capacity: 0.3, course: 0 } as const;

export interface RoiAction {
  id: string;
  title: string;
  detail: string;
  /** Estimated amount at stake, minor units (what can be recovered or gained). */
  impactCents: number;
  /** 0..1, see ROI_CONFIDENCE */
  confidence: number;
  /** Where to act */
  href: string;
}

const levelHref = (level: string) => `/ai-assistant?q=${encodeURIComponent(`arriérés ${level}`)}`;

/**
 * Candidate actions with an amount at stake: overdue balances per class, upcoming balances (preventive reminders)
 * and the growth insights (pricing, capacity, exam option). Pure and local: zero tokens.
 */
export function roiCandidates(s: CopilotSnapshot, insights: Insight[]): RoiAction[] {
  const money = (c: number) => formatMoney(c, s.currency);
  const out: RoiAction[] = [];

  const overdueByLevel = new Map<string, { count: number; total: number }>();
  for (const a of s.arrears) {
    const g = overdueByLevel.get(a.level) ?? { count: 0, total: 0 };
    overdueByLevel.set(a.level, { count: g.count + 1, total: g.total + a.owedCents });
  }
  for (const [level, g] of overdueByLevel) {
    out.push({
      id: `recover-${level}`,
      title: `Relancer ${g.count} parent${g.count > 1 ? "s" : ""} en ${level}`,
      detail: `+${money(g.total)} à recouvrer. Messages WhatsApp prêts.`,
      impactCents: g.total,
      confidence: ROI_CONFIDENCE.recovery,
      href: levelHref(level),
    });
  }

  const upcoming = s.upcoming.reduce((n, a) => n + a.owedCents, 0);
  if (upcoming > 0) {
    out.push({
      id: "upcoming", title: `Rappeler ${s.upcoming.length} échéance${s.upcoming.length > 1 ? "s" : ""} proche${s.upcoming.length > 1 ? "s" : ""}`,
      detail: `${money(upcoming)} attendus d'ici 3 jours : un rappel préventif évite l'impayé.`,
      impactCents: upcoming, confidence: ROI_CONFIDENCE.upcoming, href: "/ai-assistant?q=%C3%A9ch%C3%A9ances",
    });
  }

  for (const i of insights) {
    out.push({ id: i.id, title: i.title, detail: i.detail, impactCents: i.impactCents, confidence: ROI_CONFIDENCE[i.kind], href: "/ai-assistant/growth" });
  }
  return out;
}

/** The `n` actions with the highest confidence-weighted amount at stake (ties keep the input order). */
export function topRoiActions(s: CopilotSnapshot, insights: Insight[], n = 3): RoiAction[] {
  return roiCandidates(s, insights)
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.impactCents > 0 && a.confidence > 0)
    .sort((x, y) => y.a.impactCents * y.a.confidence - x.a.impactCents * x.a.confidence || x.i - y.i)
    .slice(0, n)
    .map(({ a }) => a);
}
