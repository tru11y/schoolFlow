import { formatMoney } from "../finance/money";
import {
  absenceMessage, arrearsMessage, buildActionCards, contactLinks, rankTeachers, underStaffed, upcomingMessage,
} from "./rules";
import { competitorStats, feesText, mentioned, wantedLevel } from "./competitors";
import { normalizeLevel } from "./benchmark";
import type { ActionLink, CopilotSnapshot } from "./types";

export type Intent = "ai" | "competitors" | "arrears" | "upcoming" | "absences" | "teachers" | "growth" | "today" | "help";

export interface ReplyItem {
  title: string;
  detail: string;
  links: ActionLink[];
}

export interface AssistantReply {
  intent: Intent;
  text: string;
  items: ReplyItem[];
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Order matters: "profs les moins assidus" must not fall into the student attendance intent. */
export function detectIntent(question: string): Intent {
  const q = fold(question);
  // Competitors first: "compare nos tarifs avec le Centre X" must not fall into the pricing / growth intents.
  if (/concurren|rival|benchmark|compar\w*\s.*tarif|tarifs?\s.*(centre|etablissement|ecole)/.test(q)) return "competitors";
  if (/\b(prof|profs|professeur|professeurs|enseignant|enseignants)\b/.test(q)) return "teachers";
  if (/echeance|prochain.*paiement|rappel.*paiement|avant la fin du mois/.test(q)) return "upcoming";
  if (/arrier|impay|reliquat|relance|recouvr|dette/.test(q)) return "arrears";
  if (/absen|retard|assidu|discipline/.test(q)) return "absences";
  if (/effectif|inscri|augmenter|parrain|recrut|prospect|fratrie|croissance/.test(q)) return "growth";
  if (/aujourd|quoi faire|priorit|urgen|resume|bilan/.test(q)) return "today";
  return "help";
}

/** "3ème", "3e", "3 eme" -> "3". Class names are compared on their leading digit. */
export const levelKey = (text: string): string | null => /(\d)\s*(?:e|è|é)?(?:me|m)?\b/i.exec(fold(text))?.[1] ?? null;

const sameLevel = (level: string, wanted: string | null) => wanted === null || levelKey(level) === wanted;

export function answer(question: string, s: CopilotSnapshot): AssistantReply {
  const intent = detectIntent(question);
  const wanted = intent === "teachers" || intent === "today" ? null : levelKey(question);
  const scope = wanted ? ` pour les classes de ${wanted}e` : "";
  const money = (c: number) => formatMoney(c, s.currency);

  switch (intent) {
    case "arrears": {
      const rows = s.arrears.filter((a) => sameLevel(a.level, wanted));
      return {
        intent,
        text: rows.length === 0 ? `Aucun impayé en retard${scope}.` : `${rows.length} élève(s) en retard de paiement${scope}, ${money(rows.reduce((n, a) => n + a.owedCents, 0))} au total.`,
        items: rows.map((a) => ({
          title: `${a.studentName} · ${a.level}`,
          detail: `${money(a.owedCents)} dus${a.parent ? ` · ${a.parent.name}` : " · aucun contact parent"}`,
          links: contactLinks(a.parent, arrearsMessage(a, s.schoolName, s.currency), `Reliquat ${a.studentName}`),
        })),
      };
    }
    case "upcoming": {
      const rows = s.upcoming.filter((a) => sameLevel(a.level, wanted));
      return {
        intent,
        text: rows.length === 0 ? `Aucune échéance dans les 3 jours${scope}.` : `${rows.length} échéance(s) dans les 3 jours${scope}.`,
        items: rows.map((a) => ({
          title: `${a.studentName} · ${a.level}`,
          detail: `${money(a.owedCents)} à régler avant le ${a.oldestDue.toLocaleDateString("fr-FR", { timeZone: "UTC" })}`,
          links: contactLinks(a.parent, upcomingMessage(a, s.schoolName, s.currency), `Échéance ${a.studentName}`),
        })),
      };
    }
    case "absences": {
      const rows = s.absences.filter((f) => sameLevel(f.level, wanted));
      return {
        intent,
        text: rows.length === 0 ? `Aucun élève au-dessus du seuil d'absences${scope} cette semaine.` : `${rows.length} élève(s) non assidus${scope} cette semaine.`,
        items: rows.map((f) => ({
          title: `${f.studentName} · ${f.level}`,
          detail: `${f.absences} absence(s), ${f.lates} retard(s)`,
          links: contactLinks(f.parent, absenceMessage(f, s.schoolName), `Assiduité ${f.studentName}`),
        })),
      };
    }
    case "teachers": {
      const ranked = rankTeachers(s.teachers).slice(0, 3);
      return {
        intent,
        text: ranked.length === 0 ? "Tous les professeurs sont à jour sur les 30 derniers jours." : "Les professeurs les moins assidus sur 30 jours (appel manqué ou tardif, cahier de texte non rempli) :",
        items: ranked.map((t, i) => ({
          title: `${i + 1}. ${t.teacherName}`,
          detail: `${t.missedRollCalls} appel(s) manqué(s) · ${t.lateRollCalls} en retard · ${t.missingLogbook} cahier(s) manquant(s) sur ${t.expectedSessions} séance(s)`,
          links: [],
        })),
      };
    }
    case "competitors": {
      const list = s.competitors ?? [];
      const page = [{ label: "Gérer les concurrents", kind: "page" as const, href: "/ai-assistant/competitors" }];
      if (list.length === 0) {
        return {
          intent,
          text: "Aucun concurrent n'est encore enregistré. Saisissez-les (nom, zone, tarifs par niveau, offres) pour obtenir des comparaisons chiffrées.",
          items: [{ title: "Ajouter la concurrence locale", detail: "Réservé au SuperAdmin.", links: page }],
        };
      }
      const named = mentioned(question, list);
      const subset = (named.length > 0 ? named : list).slice(0, 15);
      const level = wantedLevel(question);
      const own = level ? s.levels.find((l) => normalizeLevel(l.level) === level) : undefined;
      const stats = competitorStats(level, list);
      const lines: string[] = [`${list.length} concurrent(s) enregistré(s)${named.length > 0 ? `, ${named.length} correspondant à votre demande` : ""}.`];
      if (level) {
        lines.push(
          stats.count === 0
            ? `Aucun concurrent n'a de tarif renseigné en ${level}.`
            : `En ${level}, ${stats.count} concurrent(s) : de ${money(stats.min)} à ${money(stats.max)}, médiane ${money(stats.median)}.`,
        );
        if (own?.feeCents != null) {
          const gap = own.feeCents - stats.median;
          lines.push(
            stats.count === 0
              ? `Votre tarif ${own.level} : ${money(own.feeCents)}.`
              : `Votre tarif ${own.level} : ${money(own.feeCents)}, soit ${gap === 0 ? "égal à" : `${money(Math.abs(gap))} ${gap > 0 ? "au-dessus de" : "en dessous de"}`} la médiane.`,
          );
        }
      }
      return {
        intent,
        text: lines.join("\n"),
        items: subset.map((c) => ({
          title: `${c.name}${c.area ? ` · ${c.area}` : ""}`,
          detail: [feesText(c, s.currency, level), c.offers ? `Offres : ${c.offers}` : "", c.notes ? `Commentaires : ${c.notes}` : ""].filter(Boolean).join(" — "),
          links: page,
        })),
      };
    }
    case "growth": {
      const small = underStaffed(s.levels).filter((l) => sameLevel(l.level, wanted));
      const focus = small.length > 0 ? small.map((l) => `${l.level} (${l.students} élèves)`).join(", ") : "vos classes";
      return {
        intent,
        text: `Pistes pour augmenter l'effectif — priorité : ${focus}.`,
        items: [
          { title: "Parrainage", detail: "Offrez un mois ou une remise aux familles qui amènent un nouvel élève.", links: [] },
          { title: "Réduction fratrie", detail: "Proposez -10 % sur le 2e enfant inscrit pour fidéliser les familles.", links: [] },
          { title: "Séance découverte", detail: "Un cours d'essai gratuit dans les classes sous-effectif convertit mieux qu'une annonce.", links: [] },
          { title: "Relance des anciens inscrits", detail: "Contactez les familles dont l'enfant est archivé pour la rentrée.", links: [] },
        ],
      };
    }
    case "today": {
      const cards = buildActionCards(s);
      return {
        intent,
        text: cards.length === 0 ? "Rien d'urgent aujourd'hui." : `${cards.length} action(s) à traiter, par priorité :`,
        items: cards.map((c) => ({ title: c.title, detail: c.detail, links: c.links })),
      };
    }
    default:
      return {
        intent: "help",
        text: "Je peux vous aider sur ces sujets. Essayez par exemple :",
        items: [
          "Qui sont les 3 profs les moins assidus ?",
          "Génère un message de relance pour les arriérés de la 3ème",
          "Quels élèves sont absents cette semaine ?",
          "Comment augmenter notre effectif en 4ème ?",
          "Quoi faire aujourd'hui ?",
        ].map((q) => ({ title: q, detail: "", links: [{ label: "Poser la question", kind: "page" as const, href: `/ai-assistant?q=${encodeURIComponent(q)}` }] })),
      };
  }
}
