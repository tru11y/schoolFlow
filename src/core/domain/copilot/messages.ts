import { formatMoney } from "../finance/money";
import type { StudentArrear } from "./types";

export type Tone = "soft" | "firm";

const DAY_MS = 86_400_000;

/** Debts overdue by more than two weeks get the firmer (but still courteous) wording. */
export const toneFor = (a: StudentArrear, now: Date): Tone =>
  now.getTime() - a.oldestDue.getTime() > 14 * DAY_MS ? "firm" : "soft";

const first = (name: string) => name.split(" ")[0] ?? name;

/**
 * Short, polite WhatsApp/SMS text that makes paying easy: amount, child, three payment options and a clear next step.
 * Deterministic template: no model call, no token.
 */
export function collectionMessage(a: StudentArrear, school: string, currency: string, now: Date): string {
  const amount = formatMoney(a.owedCents, currency);
  const child = first(a.studentName);
  const greeting = `Bonjour ${a.parent?.name ?? ""}`.trim() + ",";

  if (toneFor(a, now) === "soft") {
    return [
      greeting,
      `un petit rappel : il reste ${amount} à régler pour les cours de renforcement de ${child} (${a.level}).`,
      "Vous pouvez payer en espèces, par Mobile Money ou par virement.",
      `Répondez à ce message pour nous confirmer la date, afin que ${child} poursuive sereinement. Merci ! ${school}`,
    ].join("\n");
  }
  return [
    greeting,
    `le solde de ${amount} pour les cours de ${child} (${a.level}) est en retard depuis le ${a.oldestDue.toLocaleDateString("fr-FR", { timeZone: "UTC" })}.`,
    "Pour garantir la continuité de ses cours, merci de régulariser cette semaine (espèces, Mobile Money ou virement).",
    `Si une difficulté se présente, répondez-nous : nous trouverons ensemble un échéancier. ${school}`,
  ].join("\n");
}
