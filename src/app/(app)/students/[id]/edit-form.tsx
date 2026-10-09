"use client";

import { useState, useTransition } from "react";
import { ENROLLMENT_STATUSES, STATUS_LABELS, type EnrollmentStatusValue } from "@/core/domain/students/student";
import { updateStudent } from "../actions";
import { ParentsFields, readParents, type ParentValue } from "../parents-fields";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

interface Props {
  id: string;
  initial: {
    level: string;
    status: EnrollmentStatusValue;
    sex: string;
    matricule: string;
    previousSchool: string;
    neighborhood: string;
    commune: string;
    city: string;
  };
  parents: ParentValue[];
  levels: string[];
}

export function EditForm({ id, initial, parents, levels }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateStudent({ ...Object.fromEntries(fd), id, parents: readParents(fd) });
          setInvalid(!res.ok && !!res.error.fieldErrors?.parents);
          if (!res.ok) return setMessage(res.error.message);
          setMessage(res.data.status === "matricule_taken" ? "Ce matricule est déjà attribué à un autre élève." : "Modifications enregistrées");
        })
      }
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="grid gap-1 text-sm">Sexe
        <select name="sex" defaultValue={initial.sex} className={field}>
          <option value="">—</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">Matricule
        <input name="matricule" defaultValue={initial.matricule} maxLength={30} placeholder="Ex: 2024-001" className={field} />
      </label>
      <label className="grid gap-1 text-sm">Classe
        <select name="level" defaultValue={initial.level} className={field}>
          {(levels.includes(initial.level) ? levels : [initial.level, ...levels]).map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Statut
        <select name="status" defaultValue={initial.status} className={field}>
          {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">École d&apos;origine
        <input name="previousSchool" defaultValue={initial.previousSchool} maxLength={100} className={field} />
      </label>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-2 text-sm text-ink/70">Adresse</legend>
        <label className="grid gap-1 text-sm">Quartier
          <input name="neighborhood" defaultValue={initial.neighborhood} maxLength={80} className={field} />
        </label>
        <label className="grid gap-1 text-sm">Commune
          <input name="commune" defaultValue={initial.commune} maxLength={80} className={field} />
        </label>
        <label className="grid gap-1 text-sm">Ville
          <input name="city" defaultValue={initial.city} maxLength={80} className={field} />
        </label>
      </fieldset>
      <ParentsFields initial={parents} invalid={invalid} />
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        {message ? <p role="status" className="text-sm text-ink/80">{message}</p> : null}
        <button disabled={pending} className="rounded-2xl bg-accent px-5 py-2.5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
          {pending ? "…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
