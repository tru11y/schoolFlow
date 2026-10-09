import { formatMoney } from "../finance/money";

/** Class levels competitors are compared on (same keys as the market benchmark). */
export const COMPETITOR_LEVELS = ["6e", "5e", "4e", "3e", "2nde", "1ère", "Tle"] as const;
export type CompetitorLevel = (typeof COMPETITOR_LEVELS)[number];

/** A competitor needs at least this many price points on a level before its median replaces the indicative matrix. */
export const MIN_COMPETITORS = 3;

export interface CompetitorView {
  id: string;
  name: string;
  area: string | null;
  contact: string | null;
  /** Key offers: packs, promotions, guarantees */
  offers: string | null;
  /** Free comments */
  notes: string | null;
  /** Monthly fee per benchmark level, minor units of the school currency */
  fees: { level: string; feeCents: number }[];
}

export interface FeeStats {
  count: number;
  min: number;
  median: number;
  max: number;
}

const median = (sorted: number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

/** Min / median / max of the competitors' fees for one level (count 0 when none). */
export function competitorStats(level: string | null, competitors: CompetitorView[]): FeeStats {
  const fees = level
    ? competitors.flatMap((c) => c.fees.filter((f) => f.level === level).map((f) => f.feeCents)).sort((a, b) => a - b)
    : [];
  if (fees.length === 0) return { count: 0, min: 0, median: 0, max: 0 };
  return { count: fees.length, min: fees[0]!, median: median(fees), max: fees[fees.length - 1]! };
}

const rank = (level: string) => COMPETITOR_LEVELS.indexOf(level as CompetitorLevel);

/** "6e : 20 000 FCFA · 3e : 27 500 FCFA", in class order; optionally restricted to one level. */
export function feesText(c: CompetitorView, currency: string, only?: string | null): string {
  const rows = c.fees.filter((f) => !only || f.level === only).sort((a, b) => rank(a.level) - rank(b.level));
  return rows.length === 0 ? "aucun tarif renseigné" : rows.map((f) => `${f.level} : ${formatMoney(f.feeCents, currency)}`).join(" · ");
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Competitors named (or located) in the question; empty when the question is generic. */
export function mentioned(question: string, competitors: CompetitorView[]): CompetitorView[] {
  const q = fold(question);
  return competitors.filter((c) => q.includes(fold(c.name)) || (c.area !== null && c.area.length >= 3 && q.includes(fold(c.area))));
}

/** Benchmark level asked about: "3ème" -> "3e", "terminale"/"tle" -> "Tle", "seconde" -> "2nde"… */
export function wantedLevel(question: string): string | null {
  const q = fold(question);
  if (/\b(terminale|tle)\b/.test(q)) return "Tle";
  if (/\b(seconde|2nde)\b/.test(q)) return "2nde";
  if (/\b(premiere|1ere)\b/.test(q)) return "1ère";
  const digit = /\b([3-6])\s*(?:e|eme|ème)\b/.exec(q)?.[1];
  return digit ? `${digit}e` : null;
}
