import Link from "next/link";
import { normalizeLevel } from "@/core/domain/copilot/benchmark";
import { COMPETITOR_LEVELS, competitorStats, feesText } from "@/core/domain/copilot/competitors";
import { CURRENCIES, formatMoney } from "@/core/domain/finance/money";
import { loadCompetitors } from "@/infrastructure/copilot/competitor-service";
import { listLevels } from "@/infrastructure/db/levels";
import { getSchoolCurrency } from "@/infrastructure/db/school";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { requirePagePermission } from "@/presentation/auth/guards";
import { Badge, Card, PageTitle } from "@/presentation/components/ui";
import { CompetitorForm, DeleteCompetitor, type CompetitorInitial } from "./competitor-form";

export const metadata = { title: "Concurrents · SchoolFlow" };

export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const principal = await requirePagePermission("copilot:use");
  const { edit } = await searchParams;
  const db = tenantPrisma(principal);
  const currency = await getSchoolCurrency(principal.schoolId);
  const { exponent, symbol } = CURRENCIES[currency];

  const [competitors, levels] = await Promise.all([loadCompetitors(db), listLevels(db)]);
  const money = (c: number) => formatMoney(c, currency);

  const editing = competitors.find((c) => c.id === edit);
  const initial: CompetitorInitial | undefined = editing && {
    id: editing.id,
    name: editing.name,
    area: editing.area ?? undefined,
    contact: editing.contact ?? undefined,
    offers: editing.offers ?? undefined,
    notes: editing.notes ?? undefined,
    fees: Object.fromEntries(editing.fees.map((f) => [f.level, f.feeCents / 10 ** exponent])),
  };

  const comparison = COMPETITOR_LEVELS.flatMap((level) => {
    const stats = competitorStats(level, competitors);
    if (stats.count === 0) return [];
    const own = levels.find((l) => normalizeLevel(l.name) === level);
    return [{ level, stats, ownName: own?.name, ownFee: own?.monthlyFee ?? null }];
  });

  return (
    <>
      <Link href="/ai-assistant" className="mb-4 inline-block text-sm text-ink/70 hover:text-ink">← Copilote IA</Link>
      <PageTitle title="Concurrents" subtitle="La concurrence locale : tarifs, offres et commentaires, lus par le Copilote pour comparer" />

      <div className="grid gap-6">
        <Card><CompetitorForm initial={initial} currency={symbol} /></Card>

        {comparison.length > 0 ? (
          <Card className="overflow-x-auto p-2 sm:p-4">
            <h2 className="px-3 pt-2 text-lg font-semibold">Comparaison avec vos tarifs</h2>
            <table className="mt-2 w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Tarifs des concurrents par niveau</caption>
              <thead className="text-ink/70"><tr>
                <th scope="col" className="px-3 py-2 font-medium">Niveau</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Vos tarifs</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Min – Médiane – Max</th>
                <th scope="col" className="px-3 py-2 font-medium">Écart à la médiane</th>
              </tr></thead>
              <tbody>
                {comparison.map(({ level, stats, ownFee }) => {
                  const gap = ownFee === null ? null : ownFee - stats.median;
                  return (
                    <tr key={level} className="border-t border-ink/10">
                      <td className="px-3 py-3 font-medium">{level} <span className="text-xs text-ink/60">({stats.count})</span></td>
                      <td className="px-3 py-3 text-right tabular-nums">{ownFee === null ? "—" : money(ownFee)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(stats.min)} – {money(stats.median)} – {money(stats.max)}</td>
                      <td className="px-3 py-3">
                        {gap === null ? "—" : gap === 0 ? <Badge tone="success">Égal</Badge> : (
                          <Badge tone={gap > 0 ? "info" : "warning"}>{gap > 0 ? "+" : "−"}{money(Math.abs(gap))}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : null}

        <section aria-labelledby="list-title">
          <h2 id="list-title" className="mb-3 text-lg font-semibold">{competitors.length} concurrent{competitors.length > 1 ? "s" : ""} enregistré{competitors.length > 1 ? "s" : ""}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {competitors.map((c) => (
              <li key={c.id} className="rounded-3xl bg-surface p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-ink/70">{[c.area, c.contact].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Link href={`/ai-assistant/competitors?edit=${c.id}`} className="min-h-9 rounded-xl px-3 py-1.5 text-sm hover:bg-raised">Modifier</Link>
                    <DeleteCompetitor id={c.id} name={c.name} />
                  </div>
                </div>
                <p className="mt-3 text-sm">{feesText(c, currency)}</p>
                {c.offers ? <p className="mt-2 text-sm text-ink/80"><span className="font-medium">Offres :</span> {c.offers}</p> : null}
                {c.notes ? <p className="mt-1 text-sm text-ink/80"><span className="font-medium">Commentaires :</span> {c.notes}</p> : null}
              </li>
            ))}
            {competitors.length === 0 ? <li className="text-sm text-ink/70">Aucun concurrent pour le moment : ajoutez-en un ci-dessus.</li> : null}
          </ul>
        </section>
      </div>
    </>
  );
}
