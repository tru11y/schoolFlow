import { formatMoney } from "../finance/money";
import { competitorStats, feesText } from "./competitors";
import { normalizeLevel } from "./benchmark";
import { rankTeachers } from "./rules";
import type { CopilotSnapshot } from "./types";

export interface LlmContext {
  /** Text sent to the model: names are replaced by codes (E1, P1...), parents and contacts are never included. */
  text: string;
  /** code -> real name, kept server-side to restore names in the answer. */
  names: Map<string, string>;
}

/** Builds the grounding data for the model without any personal identifier. */
export function buildLlmContext(s: CopilotSnapshot): LlmContext {
  const names = new Map<string, string>();
  const code = (prefix: "E" | "P", real: string): string => {
    for (const [c, n] of names) if (n === real && c.startsWith(prefix)) return c;
    const c = `${prefix}${[...names.keys()].filter((k) => k.startsWith(prefix)).length + 1}`;
    names.set(c, real);
    return c;
  };
  const money = (c: number) => formatMoney(c, s.currency);

  const lines = [
    `Établissement : ${s.schoolName} (devise ${s.currency}).`,
    "",
    "Impayés en retard :",
    ...(s.arrears.length === 0 ? ["- aucun"] : s.arrears.map((a) => `- ${code("E", a.studentName)} (${a.level}) doit ${money(a.owedCents)}, plus ancienne échéance ${a.oldestDue.toISOString().slice(0, 10)}`)),
    "",
    "Échéances dans les 3 jours :",
    ...(s.upcoming.length === 0 ? ["- aucune"] : s.upcoming.map((a) => `- ${code("E", a.studentName)} (${a.level}) doit ${money(a.owedCents)}`)),
    "",
    "Élèves non assidus (7 derniers jours, plus de 2 absences ou retards) :",
    ...(s.absences.length === 0 ? ["- aucun"] : s.absences.map((f) => `- ${code("E", f.studentName)} (${f.level}) : ${f.absences} absence(s), ${f.lates} retard(s)`)),
    "",
    "Professeurs avec manquements (30 derniers jours) :",
    ...(rankTeachers(s.teachers).length === 0
      ? ["- aucun"]
      : rankTeachers(s.teachers).map((t) => `- ${code("P", t.teacherName)} : ${t.missedRollCalls} appel(s) manqué(s), ${t.lateRollCalls} en retard, ${t.missingLogbook} cahier(s) non rempli(s) sur ${t.expectedSessions} séance(s)`)),
    "",
    "Effectif par classe :",
    ...s.levels.map((l) => `- ${l.level} : ${l.students} élève(s)${l.feeCents != null ? `, tarif mensuel ${money(l.feeCents)}` : ""}`),
    ...competitorLines(s, money),
  ];
  return { text: lines.join("\n"), names };
}

/** Competitors are businesses (not personal data): names, zones, prices and offers are sent as-is. */
function competitorLines(s: CopilotSnapshot, money: (c: number) => string): string[] {
  const list = s.competitors ?? [];
  if (list.length === 0) return ["", "Concurrents : aucun enregistré."];
  const out = ["", `Concurrents enregistrés (${list.length}) :`];
  for (const c of list.slice(0, 20)) {
    const extra = [c.offers ? `offres : ${c.offers.slice(0, 200)}` : "", c.notes ? `commentaires : ${c.notes.slice(0, 200)}` : ""].filter(Boolean).join(" ; ");
    out.push(`- ${c.name}${c.area ? ` (${c.area})` : ""} : ${feesText(c, s.currency)}${extra ? ` ; ${extra}` : ""}`);
  }
  const medians = s.levels.flatMap((l) => {
    const stats = competitorStats(normalizeLevel(l.level), list);
    return stats.count > 0 ? [`${l.level} : médiane ${money(stats.median)} sur ${stats.count} concurrent(s)${l.feeCents != null ? `, notre tarif ${money(l.feeCents)}` : ""}`] : [];
  });
  return medians.length > 0 ? [...out, "Comparaison par niveau :", ...medians.map((m) => `- ${m}`)] : out;
}

/** Puts real names back where the model wrote a code; unknown codes are left untouched. */
export function restoreNames(text: string, names: Map<string, string>): string {
  return text.replace(/\b([EP]\d+)\b/g, (m) => names.get(m) ?? m);
}

export const COPILOT_SYSTEM_PROMPT = [
  "Tu es le copilote de gestion d'un établissement scolaire de soutien. Tu réponds à la direction, en français, de façon concise et actionnable.",
  "Appuie-toi uniquement sur les données fournies dans le message. Si l'information manque, dis-le au lieu d'inventer des chiffres.",
  "Les élèves et professeurs sont désignés par des codes (E1, P1...). Réutilise ces codes tels quels, ne cherche pas à deviner les noms.",
  "Pour un message à un parent, rédige-le poli et bref, sans y mettre de nom d'enfant : écris [Prénom de l'élève] à la place.",
].join(" ");
