import { formatMoney } from "../finance/money";
import { analyzePricing, MARKET_FEES_FCFA, normalizeLevel, type GrowthSnapshot, type Insight } from "./benchmark";
import { COMPETITOR_LEVELS, competitorStats } from "./competitors";
import type { CopilotSnapshot } from "./types";

/** Compact, anonymous aggregates: this is the ONLY thing ever sent to a language model (no names, phones, e-mails). */
export interface SummaryInput {
  scope: string;
  currency: string;
  levels: { level: string; students: number; monthlyFee: number | null; marketMedian: number | null }[];
  arrears: { students: number; totalOwed: number };
  absentStudentsThisWeek: number;
  teachersWithIssues: number;
  topInsights: { title: string; impact: number }[];
  /** Anonymous aggregates of the competitors entered by the SUPER_ADMIN */
  competitors: { count: number; byLevel: { level: string; samples: number; min: number; median: number; max: number }[] };
}

export const REPORT_SYSTEM_PROMPT =
  "Tu es conseiller de gestion d'un établissement de cours de renforcement (Afrique de l'Ouest). " +
  "Réponds en français, 6 lignes maximum : un constat puis exactement 3 recommandations chiffrées. " +
  "Utilise uniquement les chiffres fournis, n'invente aucune donnée.";

/** `scope` is "school" or "class:<level>". Class scope keeps only that level's figures. */
export function buildSummaryInput(s: CopilotSnapshot, g: GrowthSnapshot, insights: Insight[], scope: string): SummaryInput {
  const level = scope.startsWith("class:") ? scope.slice(6) : null;
  const inScope = <T extends { level: string }>(rows: T[]) => rows.filter((r) => level === null || r.level === level);
  const arrears = inScope(s.arrears);
  return {
    scope,
    currency: g.currency,
    levels: inScope(g.levels).map((l) => {
      const key = normalizeLevel(l.level);
      return {
        level: l.level, students: l.students, monthlyFee: l.feeCents,
        marketMedian: g.currency === "FCFA" && key ? (MARKET_FEES_FCFA[key]?.median ?? null) : null,
      };
    }),
    arrears: { students: arrears.length, totalOwed: arrears.reduce((n, a) => n + a.owedCents, 0) },
    absentStudentsThisWeek: inScope(s.absences).length,
    teachersWithIssues: level === null ? s.teachers.filter((t) => t.missedRollCalls + t.lateRollCalls + t.missingLogbook > 0).length : 0,
    topInsights: insights
      .filter((i) => level === null || i.id.endsWith(`-${level}`))
      .slice(0, 4)
      .map((i) => ({ title: i.title, impact: i.impactCents })),
    competitors: {
      count: (g.competitors ?? []).length,
      byLevel: COMPETITOR_LEVELS.filter((l) => level === null || normalizeLevel(level) === l).flatMap((l) => {
        const st = competitorStats(l, g.competitors ?? []);
        return st.count > 0 ? [{ level: l, samples: st.count, min: st.min, median: st.median, max: st.max }] : [];
      }),
    },
  };
}

/** Zero-token summary used when no model is configured, or when the model is unreachable. */
export function localSummary(input: SummaryInput): string {
  const money = (c: number) => formatMoney(c, input.currency);
  const lines = [
    input.arrears.students > 0
      ? `${input.arrears.students} élève(s) en retard de paiement : ${money(input.arrears.totalOwed)} à recouvrer.`
      : "Aucun impayé en cours.",
  ];
  if (input.absentStudentsThisWeek > 0) lines.push(`${input.absentStudentsThisWeek} élève(s) non assidus cette semaine.`);
  input.topInsights.slice(0, 3).forEach((i, n) => lines.push(`${n + 1}. ${i.title}${i.impact > 0 ? ` (≈ ${money(i.impact)}/mois)` : ""}`));
  return lines.join("\n");
}

export const buildReportPrompt = (input: SummaryInput): string => JSON.stringify(input);

export { analyzePricing };
