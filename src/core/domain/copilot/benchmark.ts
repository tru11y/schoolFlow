import { formatMoney } from "../finance/money";

/**
 * INDICATIVE reference values for group reinforcement lessons (Abidjan / West Africa), in FCFA per month.
 * They are working assumptions, not audited market data: adjust them to your own market study.
 */
export const MARKET_FEES_FCFA: Record<string, { low: number; median: number; high: number }> = {
  "6e": { low: 15_000, median: 20_000, high: 25_000 },
  "5e": { low: 15_000, median: 20_000, high: 25_000 },
  "4e": { low: 17_000, median: 22_000, high: 28_000 },
  "3e": { low: 20_000, median: 27_500, high: 35_000 },
  "2nde": { low: 22_000, median: 30_000, high: 38_000 },
  "1ère": { low: 25_000, median: 33_000, high: 42_000 },
  Tle: { low: 28_000, median: 38_000, high: 50_000 },
};

/** Students per group that makes a reinforcement class healthy (below: not profitable, above: quality drops). */
export const OPTIMAL_CLASS_SIZE = { min: 15, max: 20 } as const;
/** Levels ending with a national exam (BEPC, BAC): candidates for an exam-prep option. */
export const EXAM_LEVELS: readonly string[] = ["3e", "Tle"];
export const EXAM_OPTION_SURCHARGE = 0.3;
export const SIBLING_DISCOUNT = 0.1;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "3ème", "3e", "Terminale C", "Seconde"… -> the benchmark key ("3e", "Tle", "2nde"…), or null. */
export function normalizeLevel(name: string): string | null {
  const n = fold(name);
  if (/^6/.test(n)) return "6e";
  if (/^5/.test(n)) return "5e";
  if (/^4/.test(n)) return "4e";
  if (/^3/.test(n)) return "3e";
  if (/^(2|seconde)/.test(n)) return "2nde";
  if (/^(1|premi)/.test(n)) return "1ère";
  if (/^(tle|t$|term)/.test(n)) return "Tle";
  return null;
}

export interface LevelStat {
  level: string;
  /** Configured monthly fee in minor units of the school currency; null when none. */
  feeCents: number | null;
  students: number;
}

export interface CourseStat {
  name: string;
  weekday: number;
  startTime: string;
  enrolled: number;
}

export interface GrowthSnapshot {
  currency: string;
  levels: LevelStat[];
  courses: CourseStat[];
  /** Families with 2+ active students sharing a parent contact. */
  siblingFamilies: number;
  siblingStudents: number;
}

export type PricePosition = "no_fee" | "unknown_level" | "below_market" | "low" | "aligned" | "above_market";

export interface PricingAnalysis {
  level: string;
  position: PricePosition;
  feeCents: number | null;
  /** Extra monthly revenue (minor units) if the fee moved to the market median. */
  upliftCents: number;
  suggestion: string;
}

/** FCFA has no minor unit: minor units == FCFA. The benchmark only applies to FCFA schools. */
export function analyzePricing(levels: LevelStat[], currency: string): PricingAnalysis[] | null {
  if (currency !== "FCFA") return null;
  return levels.map((l) => {
    const key = normalizeLevel(l.level);
    const market = key ? MARKET_FEES_FCFA[key] : undefined;
    const base = { level: l.level, feeCents: l.feeCents, upliftCents: 0 };
    if (!market) return { ...base, position: "unknown_level", suggestion: "Niveau absent du référentiel de marché." };
    if (l.feeCents === null) {
      return { ...base, position: "no_fee", suggestion: `Aucun tarif configuré : le marché pratique ${formatMoney(market.low, "FCFA")} à ${formatMoney(market.high, "FCFA")}.` };
    }
    const fee = l.feeCents;
    if (fee < market.low || fee < market.median * 0.95) {
      const uplift = Math.max(0, market.median - fee) * l.students;
      return {
        ...base,
        position: fee < market.low ? "below_market" : "low",
        upliftCents: uplift,
        suggestion:
          `${formatMoney(fee, "FCFA")} est ${fee < market.low ? "sous la fourchette" : "sous la médiane"} du marché ` +
          `(${formatMoney(market.low, "FCFA")}–${formatMoney(market.high, "FCFA")}). Un ajustement à ${formatMoney(market.median, "FCFA")} ` +
          `rapporterait ${formatMoney(uplift, "FCFA")}/mois sur ${l.students} élève(s).`,
      };
    }
    if (fee > market.high) {
      return {
        ...base,
        position: "above_market",
        suggestion: `Tarif au-dessus du marché (max ${formatMoney(market.high, "FCFA")}) : appuyez-le avec une option (suivi, examen) ou un pack d'essai.`,
      };
    }
    return { ...base, position: "aligned", suggestion: "Tarif aligné sur le marché." };
  });
}

export type SizeStatus = "empty" | "under" | "optimal" | "over";

export interface SizeAnalysis {
  level: string;
  students: number;
  status: SizeStatus;
  /** Students to recruit to reach the minimum optimal size (under), or to move out (over). */
  gap: number;
  /** Monthly revenue the missing students would bring at the configured fee. */
  potentialCents: number;
  suggestion: string;
}

export function analyzeClassSizes(levels: LevelStat[], currency: string): SizeAnalysis[] {
  const { min, max } = OPTIMAL_CLASS_SIZE;
  return levels.map((l) => {
    if (l.students > max) {
      return { level: l.level, students: l.students, status: "over", gap: l.students - max, potentialCents: 0, suggestion: `${l.level} : ${l.students} élèves (> ${max}). Ouvrez un second groupe ou créneau.` };
    }
    if (l.students >= min) {
      return { level: l.level, students: l.students, status: "optimal", gap: 0, potentialCents: 0, suggestion: `${l.level} : effectif optimal.` };
    }
    const gap = min - l.students;
    const potential = (l.feeCents ?? 0) * gap;
    const money = potential > 0 ? ` → jusqu'à +${formatMoney(potential, currency)}/mois` : "";
    return {
      level: l.level, students: l.students, status: l.students === 0 ? "empty" : "under", gap, potentialCents: potential,
      suggestion: `${l.level} : ${l.students}/${min} élèves. Recruter ${gap} élève(s)${money}.`,
    };
  });
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export interface CourseAnalysis {
  name: string;
  slot: string;
  enrolled: number;
  missing: number;
  suggestion: string;
}

/** Reinforcement sessions under the minimum optimal group size, emptiest first. */
export function analyzeCourses(courses: CourseStat[]): CourseAnalysis[] {
  return courses
    .filter((c) => c.enrolled < OPTIMAL_CLASS_SIZE.min)
    .map((c) => {
      const slot = `${DAYS[c.weekday - 1] ?? "?"} ${c.startTime.replace(":", "h")}`;
      const missing = OPTIMAL_CLASS_SIZE.min - c.enrolled;
      return {
        name: c.name, slot, enrolled: c.enrolled, missing,
        suggestion: `${c.name} (${slot}) : ${c.enrolled} inscrit(s). Ciblez ${missing} familles par message WhatsApp ou parrainage.`,
      };
    })
    .sort((a, b) => a.enrolled - b.enrolled || a.name.localeCompare(b.name));
}

export interface SiblingContact {
  studentId: string;
  phone: string | null;
  email: string | null;
}

/** Families = students sharing a phone number or e-mail. Returns how many families have 2+ students. */
export function groupSiblings(contacts: SiblingContact[]): { families: number; students: number } {
  const byKey = new Map<string, Set<string>>();
  for (const c of contacts) {
    for (const key of [c.phone?.replace(/[^\d]/g, ""), c.email?.toLowerCase()]) {
      if (!key) continue;
      byKey.set(key, (byKey.get(key) ?? new Set()).add(c.studentId));
    }
  }
  const multi = [...byKey.values()].filter((s) => s.size >= 2);
  return { families: multi.length, students: new Set(multi.flatMap((s) => [...s])).size };
}

export interface Insight {
  id: string;
  kind: "pricing" | "capacity" | "course" | "pack";
  title: string;
  detail: string;
  /** Estimated monthly revenue effect in minor units (0 = not a revenue estimate). */
  impactCents: number;
}

export function buildInsights(g: GrowthSnapshot): Insight[] {
  const out: Insight[] = [];
  const money = (c: number) => formatMoney(c, g.currency);

  for (const p of analyzePricing(g.levels, g.currency) ?? []) {
    if (p.upliftCents > 0) out.push({ id: `price-${p.level}`, kind: "pricing", title: `Ajuster le tarif ${p.level}`, detail: p.suggestion, impactCents: p.upliftCents });
  }
  for (const s of analyzeClassSizes(g.levels, g.currency)) {
    if (s.status === "under" || s.status === "empty") {
      out.push({ id: `size-${s.level}`, kind: "capacity", title: `Remplir la classe de ${s.level}`, detail: s.suggestion, impactCents: s.potentialCents });
    } else if (s.status === "over") {
      out.push({ id: `size-${s.level}`, kind: "capacity", title: `Ajuster l'effectif en ${s.level}`, detail: s.suggestion, impactCents: 0 });
    }
  }
  for (const c of analyzeCourses(g.courses).slice(0, 3)) {
    out.push({ id: `course-${c.name}`, kind: "course", title: `Campagne : ${c.name}`, detail: c.suggestion, impactCents: 0 });
  }
  if (g.siblingFamilies > 0) {
    out.push({
      id: "pack-fratrie", kind: "pack", title: "Pack Fratrie",
      detail: `${g.siblingFamilies} famille(s) (${g.siblingStudents} élèves) ont plusieurs enfants inscrits : une remise de ${SIBLING_DISCOUNT * 100} % sur le second enfant fidélise et attire les familles voisines.`,
      impactCents: 0,
    });
  }
  for (const l of g.levels) {
    if (!EXAM_LEVELS.includes(normalizeLevel(l.level) ?? "") || l.students === 0 || l.feeCents === null) continue;
    const max = Math.round(l.feeCents * EXAM_OPTION_SURCHARGE) * l.students;
    out.push({
      id: `exam-${l.level}`, kind: "pack", title: `Option Examen ${l.level}`,
      detail: `Supplément de ${EXAM_OPTION_SURCHARGE * 100} % (révisions + examens blancs) pour ${l.students} élève(s) : potentiel maximal ${money(max)}/mois si tous la prennent.`,
      impactCents: Math.round(max / 2),
    });
  }
  return out.sort((a, b) => b.impactCents - a.impactCents);
}
