"use client";

import { useState } from "react";

export interface ParentValue {
  name: string;
  relation: string;
  phone: string;
  email: string;
}

const EMPTY: ParentValue = { name: "", relation: "", phone: "", email: "" };

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

/** Builds the `parents` array from the `parentN_*` inputs; a removed second contact is simply absent. */
export function readParents(fd: FormData): ParentValue[] {
  return [0, 1].flatMap((i) =>
    fd.has(`parent${i}_name`)
      ? [{
          name: String(fd.get(`parent${i}_name`)),
          relation: String(fd.get(`parent${i}_relation`)),
          phone: String(fd.get(`parent${i}_phone`)),
          email: String(fd.get(`parent${i}_email`)),
        }]
      : [],
  );
}

const RELATIONS = ["Père", "Mère", "Tuteur légal", "Oncle", "Tante", "Grand-parent"];

function ParentBlock({ index, value }: { index: number; value: ParentValue }) {
  return (
    <div className="grid gap-3 rounded-3xl bg-canvas/60 p-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Nom complet
        <input name={`parent${index}_name`} defaultValue={value.name} required maxLength={100} className={field} />
      </label>
      <label className="grid gap-1 text-sm">Relation avec l&apos;élève
        <input name={`parent${index}_relation`} defaultValue={value.relation} required maxLength={40} list="relations" className={field} />
      </label>
      <label className="grid gap-1 text-sm">Téléphone
        <input name={`parent${index}_phone`} type="tel" defaultValue={value.phone} maxLength={30} className={field} />
      </label>
      <label className="grid gap-1 text-sm">E-mail
        <input name={`parent${index}_email`} type="email" defaultValue={value.email} maxLength={254} className={field} />
      </label>
    </div>
  );
}

export function ParentsFields({ initial, invalid }: { initial?: ParentValue[]; invalid?: boolean }) {
  const [second, setSecond] = useState<ParentValue | null>(initial?.[1] ?? null);

  return (
    <fieldset className="grid gap-3 sm:col-span-2">
      <legend className="mb-2 text-sm text-ink/70">Contacts parents</legend>
      <datalist id="relations">{RELATIONS.map((r) => <option key={r} value={r} />)}</datalist>
      <ParentBlock index={0} value={initial?.[0] ?? EMPTY} />
      {second ? (
        <div className="grid gap-2">
          <ParentBlock index={1} value={second} />
          <button type="button" onClick={() => setSecond(null)} className="justify-self-end text-sm text-ink/70 hover:text-ink">
            Retirer le contact complémentaire
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSecond(EMPTY)}
          className="w-fit rounded-2xl bg-raised px-4 py-2 text-sm outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
        >
          + Ajouter un contact complémentaire
        </button>
      )}
      {invalid ? (
        <p role="alert" className="text-sm text-danger">
          Chaque contact doit avoir un nom, une relation et un téléphone ou un e-mail valide.
        </p>
      ) : null}
    </fieldset>
  );
}
