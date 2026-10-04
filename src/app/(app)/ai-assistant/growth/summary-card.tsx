"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import type { ReportResult } from "@/core/application/copilot/report";
import { generateAiSummary } from "./actions";

const SOURCE_LABEL = {
  model: "Généré par le modèle",
  cache: "Résultat du jour (cache, 0 appel)",
  local: "Calcul local (0 token)",
} as const;

export function SummaryCard({ scopes, initial = null, title = "Résumé stratégique" }: { scopes: { value: string; label: string }[]; initial?: ReportResult | null; title?: string }) {
  const [scope, setScope] = useState(scopes[0]?.value ?? "school");
  const [result, setResult] = useState<ReportResult | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-ink/70">Un seul appel au modèle par jour et par périmètre ; ensuite le résultat est réutilisé.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="Périmètre du résumé"
            className="min-h-11 rounded-2xl bg-canvas px-4 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await generateAiSummary({ scope });
                if (res.ok) setResult(res.data);
                else setError(res.error.message);
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-accent px-5 text-sm font-semibold text-canvas outline-none transition focus-visible:ring-4 focus-visible:ring-accent/40 active:scale-95 disabled:opacity-70"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            Générer le résumé
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-2xl bg-canvas/60 p-4 ring-1 ring-ink/10" role="status">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.text}</p>
          <p className="mt-3 text-xs text-ink/60">
            {SOURCE_LABEL[result.source]}
            {result.model ? ` · ${result.model}` : ""}
            {result.error ? " · modèle indisponible, résumé local affiché" : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
