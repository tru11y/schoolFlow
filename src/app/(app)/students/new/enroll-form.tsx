"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createStudent, type CreateStudentResult } from "../actions";
import { ParentsFields, readParents } from "../parents-fields";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-3 outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

function Field({ label, errors, children }: { label: string; errors?: string[]; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      {children}
      {errors?.length ? <span role="alert" className="text-xs text-danger">Champ invalide</span> : null}
    </label>
  );
}

interface LevelFee {
  name: string;
  fee: number | null;
}

export function EnrollForm({ currencySymbol, levels }: { currencySymbol: string; levels: LevelFee[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [level, setLevel] = useState("");
  const [installments, setInstallments] = useState(3);
  const [total, setTotal] = useState("");
  const [totalEdited, setTotalEdited] = useState(false);
  const [created, setCreated] = useState<Extract<CreateStudentResult, { status: "created" }> | null>(null);

  /** Suggests total = level fee x installments, until the user types their own total. */
  const suggest = (levelName: string, count: number) => {
    const fee = levels.find((l) => l.name === levelName)?.fee;
    if (!totalEdited && fee != null) setTotal(String(fee * count));
  };
  const pickLevel = (name: string) => {
    setLevel(name);
    suggest(name, installments);
  };
  const pickInstallments = (count: number) => {
    setInstallments(count);
    suggest(level, count);
  };

  if (created) {
    return (
      <div className="grid gap-4" role="status">
        <h2 className="text-xl font-semibold">Inscription enregistrée ✅</h2>
        <p className="text-sm text-ink/70">Mot de passe provisoire (affiché une seule fois) :</p>
        <code className="w-fit rounded-2xl bg-canvas px-4 py-3 font-mono text-lg">{created.tempPassword}</code>
        <Link href={`/students/${created.id}`} className="w-fit rounded-2xl bg-accent px-5 py-3 font-medium text-canvas">
          Ouvrir la fiche
        </Link>
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await createStudent({ ...Object.fromEntries(fd), parents: readParents(fd) });
          setError(null);
          setFieldErrors({});
          if (!res.ok) {
            setFieldErrors(res.error.fieldErrors ?? {});
            return setError(res.error.message);
          }
          if (res.data.status === "email_taken") return setError("Cette adresse e-mail est déjà utilisée.");
          setCreated(res.data);
        })
      }
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Prénom" errors={fieldErrors.firstName}><input name="firstName" required maxLength={60} className={field} /></Field>
      <Field label="Nom" errors={fieldErrors.lastName}><input name="lastName" required maxLength={60} className={field} /></Field>
      <Field label="E-mail de l'élève" errors={fieldErrors.email}><input name="email" type="email" required className={field} /></Field>
      
      <Field label="Classe" errors={fieldErrors.level}>
        <select name="level" required value={level} onChange={(e) => pickLevel(e.target.value)} className={field}>
          <option value="" disabled>Choisir…</option>
          {levels.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Adresse" errors={fieldErrors.address}><input name="address" required maxLength={200} className={field} /></Field>
      <ParentsFields invalid={!!fieldErrors.parents} />

      <fieldset className="grid gap-4 rounded-3xl bg-canvas/60 p-4 sm:col-span-2 sm:grid-cols-3">
        <legend className="px-2 text-sm text-ink/70">Échéancier initial</legend>
        <Field label={`Total (${currencySymbol})`} errors={fieldErrors.total}><input name="total" type="number" min={0} step="any" value={total} onChange={(e) => { setTotalEdited(true); setTotal(e.target.value); }} required className={field} /></Field>
        <Field label="Nombre d'échéances" errors={fieldErrors.installments}><input name="installments" type="number" min={1} max={12} value={installments} onChange={(e) => pickInstallments(Number(e.target.value) || 1)} required className={field} /></Field>
        <Field label="Première échéance" errors={fieldErrors.firstDue}><input name="firstDue" type="date" required className={field} /></Field>
      </fieldset>

      {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
      <div className="flex justify-end gap-3 sm:col-span-2">
        <Link href="/students" className="rounded-2xl px-5 py-3 text-ink/80 hover:bg-raised">Annuler</Link>
        <button disabled={pending} className="rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
          {pending ? "Enregistrement…" : "Inscrire l'élève"}
        </button>
      </div>
    </form>
  );
}
