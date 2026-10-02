"use client";

import { useState, useTransition } from "react";
import { ENROLLMENT_STATUSES, LEVELS, STATUS_LABELS, type EnrollmentStatusValue } from "@/core/domain/students/student";
import { updateStudent } from "../actions";
import { ParentsFields, readParents, type ParentValue } from "../parents-fields";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

interface Props {
  id: string;
  initial: { level: string; address: string; status: EnrollmentStatusValue };
  parents: ParentValue[];
}

export function EditForm({ id, initial, parents }: Props) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateStudent({ ...Object.fromEntries(fd), id, parents: readParents(fd) });
          setInvalid(!res.ok && !!res.error.fieldErrors?.parents);
          setMessage(res.ok ? "Modifications enregistrées" : res.error.message);
        })
      }
      className="grid gap-3 sm:grid-cols-2"
    >
      <label className="grid gap-1 text-sm">Classe
        <select name="level" defaultValue={initial.level} className={field}>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Statut
        <select name="status" defaultValue={initial.status} className={field}>
          {ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm sm:col-span-2">Adresse
        <input name="address" defaultValue={initial.address} required maxLength={200} className={field} />
      </label>
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
