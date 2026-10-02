"use client";

import { useState, useTransition } from "react";
import { createLevel, deleteLevel, updateLevel, type LevelResult } from "./actions";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

function message(res: { ok: true; data: LevelResult } | { ok: false; error: { message: string } }): string | null {
  if (!res.ok) return res.error.message;
  if (res.data.status === "exists") return "Ce niveau existe déjà.";
  if (res.data.status === "in_use") return `Suppression impossible : ${res.data.count} élément(s) utilisent ce niveau.`;
  return null;
}

export function AddLevel({ currency }: { currency: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await createLevel(Object.fromEntries(fd));
          setError(message(res));
        })
      }
      className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
    >
      <label className="grid gap-1 text-sm">Nom du niveau
        <input name="name" required maxLength={40} placeholder="ex. Terminale C" className={field} />
      </label>
      <label className="grid gap-1 text-sm">Mensualité ({currency}, optionnel)
        <input name="monthlyFee" type="number" min={0} step="any" className={field} />
      </label>
      <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas active:scale-95 disabled:opacity-60">
        {pending ? "…" : "Ajouter"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-300 sm:col-span-3">{error}</p> : null}
    </form>
  );
}

interface RowProps {
  id: string;
  name: string;
  feeMajor: number | null;
  currency: string;
  used: number;
}

export function LevelRow({ id, name, feeMajor, currency, used }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-ink/70">
            {feeMajor === null ? "Pas de tarif" : `${feeMajor.toLocaleString("fr-FR")} ${currency} / mois`} · {used} élève{used > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="min-h-9 rounded-xl px-3 text-sm hover:bg-raised">Modifier</button>
          {confirming ? (
            <>
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(message(await deleteLevel({ id })));
                    setConfirming(false);
                  })
                }
                className="min-h-9 rounded-xl bg-red-400/20 px-3 text-sm text-red-200 hover:bg-red-400/30"
              >
                Confirmer la suppression
              </button>
              <button onClick={() => setConfirming(false)} className="min-h-9 rounded-xl px-3 text-sm hover:bg-raised">Annuler</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="min-h-9 rounded-xl px-3 text-sm text-red-300 hover:bg-red-400/10">
              Supprimer
            </button>
          )}
        </div>
        {error ? <p role="alert" className="w-full text-sm text-red-300">{error}</p> : null}
      </li>
    );
  }

  return (
    <li className="rounded-2xl bg-canvas p-3">
      <form
        action={(fd) =>
          start(async () => {
            const res = await updateLevel({ ...Object.fromEntries(fd), id });
            const m = message(res);
            setError(m);
            if (!m) setEditing(false);
          })
        }
        className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end"
      >
        <label className="grid gap-1 text-sm">Nom
          <input name="name" required maxLength={40} defaultValue={name} className={field} />
        </label>
        <label className="grid gap-1 text-sm">Mensualité ({currency})
          <input name="monthlyFee" type="number" min={0} step="any" defaultValue={feeMajor ?? ""} className={field} />
        </label>
        <div className="flex gap-2">
          <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-4 font-medium text-canvas disabled:opacity-60">Enregistrer</button>
          <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-2xl px-4 text-ink/80 hover:bg-raised">Annuler</button>
        </div>
        {error ? <p role="alert" className="text-sm text-red-300 sm:col-span-3">{error}</p> : null}
      </form>
    </li>
  );
}
