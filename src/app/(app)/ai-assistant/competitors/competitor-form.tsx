"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COMPETITOR_LEVELS } from "@/core/domain/copilot/competitors";
import { deleteCompetitor, saveCompetitor } from "./actions";

export interface CompetitorInitial {
  id?: string;
  name?: string;
  area?: string;
  contact?: string;
  offers?: string;
  notes?: string;
  /** level -> fee in major units of the school currency */
  fees?: Record<string, number>;
}

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

export function CompetitorForm({ initial, currency }: { initial?: CompetitorInitial; currency: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editing = Boolean(initial?.id);

  return (
    <form
      key={initial?.id ?? (saved ? "saved" : "new")}
      action={(fd) =>
        start(async () => {
          setError(null);
          const res = await saveCompetitor({
            id: initial?.id,
            name: fd.get("name"),
            area: fd.get("area"),
            contact: fd.get("contact"),
            offers: fd.get("offers"),
            notes: fd.get("notes"),
            fees: COMPETITOR_LEVELS.map((level) => ({ level, fee: fd.get(`fee_${level}`) ?? "" })),
          });
          if (!res.ok) return setError(res.error.fieldErrors ? "Vérifiez le nom et les tarifs (nombres positifs)." : res.error.message);
          setSaved((v) => !v);
          router.replace("/ai-assistant/competitors");
          router.refresh();
        })
      }
      className="grid gap-4 sm:grid-cols-2"
    >
      <h2 className="text-lg font-semibold sm:col-span-2">{editing ? "Modifier le concurrent" : "Ajouter un concurrent"}</h2>
      <label className="grid gap-1 text-sm">Établissement / centre
        <input name="name" required maxLength={100} defaultValue={initial?.name} className={field} />
      </label>
      <label className="grid gap-1 text-sm">Quartier / zone
        <input name="area" maxLength={80} defaultValue={initial?.area} placeholder="ex. Cocody" className={field} />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">Contact (téléphone, site…)
        <input name="contact" maxLength={120} defaultValue={initial?.contact} className={field} />
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm">Tarif mensuel par niveau ({currency}) — laissez vide si inconnu</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COMPETITOR_LEVELS.map((level) => (
            <label key={level} className="grid gap-1 text-xs text-ink/70">
              {level}
              <input
                name={`fee_${level}`}
                type="number"
                min={0}
                step="any"
                inputMode="numeric"
                defaultValue={initial?.fees?.[level]}
                className={field}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1 text-sm sm:col-span-2">Offres clés (packs, promotions, garanties)
        <textarea name="offers" rows={2} maxLength={600} defaultValue={initial?.offers} className={field} />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">Commentaires
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={initial?.notes} className={field} />
      </label>

      {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
      <div className="flex justify-end gap-3 sm:col-span-2">
        {editing ? (
          <button type="button" onClick={() => router.replace("/ai-assistant/competitors")} className="rounded-2xl px-5 py-2.5 text-ink/80 hover:bg-raised">
            Annuler
          </button>
        ) : null}
        <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
          {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

export function DeleteCompetitor({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} aria-label={`Supprimer ${name}`} className="min-h-9 rounded-xl px-3 text-sm text-danger hover:bg-danger/10">
        Supprimer
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteCompetitor({ id });
            if (!res.ok) return setError(res.error.message);
            router.refresh();
          })
        }
        className="min-h-9 rounded-xl bg-danger/15 px-3 text-sm text-danger hover:bg-danger/25"
      >
        Confirmer
      </button>
      <button onClick={() => setConfirming(false)} className="min-h-9 rounded-xl px-3 text-sm hover:bg-raised">Annuler</button>
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
