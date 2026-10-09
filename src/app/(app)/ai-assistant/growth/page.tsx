import Link from "next/link";
import { analyzeClassSizes, analyzeCourses, analyzePricing, buildInsights, OPTIMAL_CLASS_SIZE } from "@/core/domain/copilot/benchmark";
import { collectionMessage, toneFor } from "@/core/domain/copilot/messages";
import { contactLinks } from "@/core/domain/copilot/rules";
import { formatMoney } from "@/core/domain/finance/money";
import { loadSnapshot } from "@/infrastructure/copilot/copilot-service";
import { loadGrowth } from "@/infrastructure/copilot/growth-service";
import { requirePagePermission } from "@/presentation/auth/guards";
import { ActionLinks } from "@/presentation/components/copilot-cards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { SummaryCard } from "./summary-card";

export const metadata = { title: "Stratégie & benchmark · SchoolFlow" };

const POSITION = {
  no_fee: { label: "Sans tarif", tone: "warning" },
  unknown_level: { label: "Hors référentiel", tone: "info" },
  below_market: { label: "Sous le marché", tone: "danger" },
  low: { label: "Sous la médiane", tone: "warning" },
  aligned: { label: "Aligné", tone: "success" },
  above_market: { label: "Premium", tone: "info" },
} as const;

const SIZE = {
  empty: { label: "Vide", tone: "danger" },
  under: { label: "Sous-effectif", tone: "warning" },
  optimal: { label: "Optimal", tone: "success" },
  over: { label: "Surcharge", tone: "danger" },
} as const;

export default async function GrowthPage() {
  const principal = await requirePagePermission("copilot:use");
  const [snapshot, growth] = await Promise.all([loadSnapshot(principal), loadGrowth(principal)]);
  const now = new Date();
  const money = (c: number) => formatMoney(c, growth.currency);

  const pricing = analyzePricing(growth.levels, growth.currency, growth.competitors);
  const sizes = analyzeClassSizes(growth.levels, growth.currency);
  const courses = analyzeCourses(growth.courses);
  const insights = buildInsights(growth);
  const scopes = [{ value: "school", label: "Toute l'école" }, ...growth.levels.map((l) => ({ value: `class:${l.level}`, label: `Classe ${l.level}` }))];

  return (
    <>
      <Link href="/ai-assistant" className="mb-4 inline-block text-sm text-ink/70 hover:text-ink">← Copilote IA</Link>
      <PageTitle title="Stratégie & benchmark" subtitle="Tarifs face au marché, remplissage des classes et relances prêtes à envoyer" />

      <div className="grid gap-6">
        <SummaryCard scopes={scopes} />

        <Card>
          <h2 className="mb-1 text-lg font-semibold">Opportunités de croissance</h2>
          <p className="mb-4 text-sm text-ink/70">Calculées localement, classées par impact mensuel estimé.</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <li key={i.id} className="rounded-2xl bg-canvas/60 p-4 ring-1 ring-ink/10">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{i.title}</p>
                  {i.impactCents > 0 ? <Badge tone="success">≈ {money(i.impactCents)}/mois</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-ink/70">{i.detail}</p>
              </li>
            ))}
            {insights.length === 0 ? <li className="text-sm text-ink/70">Aucune opportunité détectée : tarifs et effectifs sont dans les normes.</li> : null}
          </ul>
        </Card>

        <Card className="overflow-x-auto p-2 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-2">
            <h2 className="text-lg font-semibold">Tarifs face au marché</h2>
            <Link href="/ai-assistant/competitors" className="text-sm font-medium text-accent hover:underline">Gérer les concurrents ({growth.competitors?.length ?? 0})</Link>
          </div>
          {pricing === null ? (
            <p className="px-3 pb-3 pt-2 text-sm text-ink/70">Le référentiel de marché est exprimé en FCFA : il ne s&apos;applique pas à la devise de l&apos;école.</p>
          ) : (
            <>
              <p className="px-3 pb-2 text-xs text-ink/60">Valeurs de référence indicatives (cours de renforcement en groupe, Abidjan / Afrique de l&apos;Ouest) : à ajuster selon votre étude de marché.</p>
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Comparaison des tarifs avec le marché</caption>
                <thead className="text-ink/70"><tr>
                  <th scope="col" className="px-3 py-2 font-medium">Niveau</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Tarif</th>
                  <th scope="col" className="px-3 py-2 font-medium">Position</th>
                  <th scope="col" className="px-3 py-2 font-medium">Recommandation</th>
                </tr></thead>
                <tbody>
                  {pricing.map((p) => (
                    <tr key={p.level} className="border-t border-ink/10 align-top">
                      <td className="px-3 py-3 font-medium">{p.level}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.feeCents === null ? "—" : money(p.feeCents)}</td>
                      <td className="px-3 py-3"><Badge tone={POSITION[p.position].tone}>{POSITION[p.position].label}</Badge></td>
                      <td className="px-3 py-3 text-ink/80">{p.suggestion}{p.source ? <span className="mt-1 block text-xs text-ink/60">Base : {p.source === "concurrents" ? `${p.sample} concurrent(s) saisis` : "référentiel indicatif"}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>

        <Card className="overflow-x-auto p-2 sm:p-4">
          <h2 className="px-3 pt-2 text-lg font-semibold">Remplissage des classes</h2>
          <p className="px-3 pb-2 text-xs text-ink/60">Effectif optimal : {OPTIMAL_CLASS_SIZE.min} à {OPTIMAL_CLASS_SIZE.max} élèves par groupe.</p>
          <ul className="grid gap-2 px-1 pb-2">
            {sizes.map((s) => (
              <li key={s.level} className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-ink/10">
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{s.level} · {s.students} élève(s)</span>
                  <Badge tone={SIZE[s.status].tone}>{SIZE[s.status].label}</Badge>
                </div>
                <div role="progressbar" aria-label={`Remplissage ${s.level}`} aria-valuenow={s.students} aria-valuemin={0} aria-valuemax={OPTIMAL_CLASS_SIZE.max} className="h-2 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (s.students / OPTIMAL_CLASS_SIZE.max) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-ink/70">{s.suggestion}</p>
              </li>
            ))}
          </ul>
        </Card>

        {courses.length > 0 ? (
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Séances sous-occupées</h2>
            <ul className="grid gap-2">
              {courses.map((c) => (
                <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-canvas/60 px-4 py-3 text-sm ring-1 ring-ink/10">
                  <span>{c.suggestion}</span>
                  <Badge tone="warning">{c.enrolled}/{OPTIMAL_CLASS_SIZE.min}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-1 text-lg font-semibold">Relances à envoyer</h2>
          <p className="mb-4 text-sm text-ink/70">Messages courts et courtois, prêts pour WhatsApp ou SMS. Rien n&apos;est envoyé automatiquement.</p>
          <ul className="grid gap-3">
            {snapshot.arrears.slice(0, 12).map((a) => {
              const text = collectionMessage(a, snapshot.schoolName, snapshot.currency, now);
              return (
                <li key={a.studentId} className="rounded-2xl bg-canvas/60 p-4 ring-1 ring-ink/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{a.studentName} · {a.level}</p>
                    <div className="flex items-center gap-2">
                      <Badge tone={toneFor(a, now) === "firm" ? "danger" : "warning"}>{toneFor(a, now) === "firm" ? "Ferme" : "Rappel"}</Badge>
                      <Badge tone="success">{money(a.owedCents)}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{text}</p>
                  <ActionLinks links={contactLinks(a.parent, text, `Règlement des cours de ${a.studentName}`)} />
                </li>
              );
            })}
            {snapshot.arrears.length === 0 ? <li className="text-sm text-ink/70">Aucun impayé en retard : rien à relancer.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}
