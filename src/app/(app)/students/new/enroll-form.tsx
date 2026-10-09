"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createStudent, type CreateStudentResult } from "../actions";

const field =
  "w-full rounded-2xl bg-canvas/70 px-4 py-3 text-base outline-none ring-1 ring-ink/15 transition focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-accent";

const RELATIONS = ["Père", "Mère", "Tuteur"] as const;
const MAX_PARENTS = 2;

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-surface/70 p-5 shadow-soft ring-1 ring-ink/10 backdrop-blur-2xl sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, errors, className = "", children }: { label: string; errors?: string[]; className?: string; children: React.ReactNode }) {
  return (
    <label className={`grid gap-1.5 text-sm font-medium ${className}`}>
      {label}
      {children}
      {errors?.length ? <span role="alert" className="text-xs font-normal text-danger">Champ invalide</span> : null}
    </label>
  );
}

/** Reads the `parentN_*` inputs; blocks removed from the form are simply absent. */
function readParents(fd: FormData) {
  return Array.from({ length: MAX_PARENTS }, (_, i) => i).flatMap((i) =>
    fd.has(`parent${i}_name`)
      ? [{ name: String(fd.get(`parent${i}_name`)), phone: String(fd.get(`parent${i}_phone`)), relation: String(fd.get(`parent${i}_relation`)) }]
      : [],
  );
}

export function EnrollForm({ levels }: { levels: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [parentKeys, setParentKeys] = useState<number[]>([0]);
  const [created, setCreated] = useState<Extract<CreateStudentResult, { status: "created" }> | null>(null);

  if (created) {
    return (
      <div className="grid gap-4 rounded-[2rem] bg-surface/70 p-6 shadow-soft ring-1 ring-ink/10" role="status">
        <h2 className="text-xl font-semibold">Élève créé ✅</h2>
        <p className="text-sm text-ink/70">Identifiant de connexion :</p>
        <code className="w-fit break-all rounded-2xl bg-canvas px-4 py-3 font-mono text-lg">{created.login}</code>
        <p className="text-sm text-ink/70">Mot de passe provisoire (affiché une seule fois) :</p>
        <code className="w-fit rounded-2xl bg-canvas px-4 py-3 font-mono text-lg">{created.tempPassword}</code>
        <Link href={`/students/${created.id}`} className="w-fit rounded-2xl bg-sky px-5 py-3 font-medium text-canvas">
          Ouvrir la fiche
        </Link>
      </div>
    );
  }

  const nextKey = [0, 1].find((k) => !parentKeys.includes(k));

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
          if (res.data.status === "matricule_taken") {
            setFieldErrors({ matricule: ["Matricule déjà utilisé"] });
            return setError("Ce matricule est déjà attribué à un autre élève.");
          }
          setCreated(res.data);
        })
      }
      className="grid gap-5"
    >
      <Section title="Informations personnelles">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom *" errors={fieldErrors.firstName}><input name="firstName" required maxLength={60} className={field} /></Field>
          <Field label="Nom *" errors={fieldErrors.lastName}><input name="lastName" required maxLength={60} className={field} /></Field>
          <Field label="Sexe" errors={fieldErrors.sex}>
            <select name="sex" defaultValue="" className={field}>
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </Field>
          <Field label="Matricule" errors={fieldErrors.matricule}>
            <input name="matricule" maxLength={30} placeholder="Ex: 2024-001" className={field} />
          </Field>
        </div>
      </Section>

      <Section title="Scolarité">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Classe *" errors={fieldErrors.level}>
            <select name="level" required defaultValue="" className={field}>
              <option value="" disabled>Sélectionner une classe</option>
              {levels.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
          <Field label="École d'origine" errors={fieldErrors.previousSchool}><input name="previousSchool" maxLength={100} className={field} /></Field>
        </div>
      </Section>

      <Section title="Adresse">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quartier" errors={fieldErrors.neighborhood}><input name="neighborhood" maxLength={80} className={field} /></Field>
          <Field label="Commune" errors={fieldErrors.commune}><input name="commune" maxLength={80} className={field} /></Field>
          <Field label="Ville" errors={fieldErrors.city}><input name="city" maxLength={80} className={field} /></Field>
        </div>
      </Section>

      <Section
        title="Parents / Tuteurs"
        action={
          nextKey !== undefined ? (
            <button
              type="button"
              onClick={() => setParentKeys((k) => [...k, nextKey])}
              className="min-h-10 rounded-2xl bg-sky/15 px-4 text-sm font-medium text-sky outline-none ring-1 ring-sky/30 transition hover:bg-sky/25 focus-visible:ring-2 active:scale-95"
            >
              + Ajouter un parent
            </button>
          ) : null
        }
      >
        <div className="grid gap-4">
          {parentKeys.map((key, position) => (
            <div key={key} className="grid gap-4 rounded-3xl bg-canvas/50 p-4 ring-1 ring-ink/10 sm:grid-cols-3">
              <p className="text-sm font-semibold sm:col-span-3">
                Parent {position + 1}
                {position > 0 ? (
                  <button type="button" onClick={() => setParentKeys((k) => k.filter((x) => x !== key))} className="ml-3 text-xs font-normal text-danger hover:underline">
                    Retirer
                  </button>
                ) : null}
              </p>
              <Field label="Nom" errors={fieldErrors.parents}><input name={`parent${key}_name`} required maxLength={100} className={field} /></Field>
              <Field label="Téléphone"><input name={`parent${key}_phone`} type="tel" inputMode="tel" required maxLength={30} className={field} /></Field>
              <Field label="Lien">
                <select name={`parent${key}_relation`} defaultValue="Père" className={field}>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
          ))}
        </div>
        {fieldErrors.parents ? <p role="alert" className="mt-3 text-sm text-danger">Chaque parent doit avoir un nom, un téléphone et un lien.</p> : null}
      </Section>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/students" className="grid min-h-12 place-items-center rounded-2xl px-6 text-ink/80 ring-1 ring-ink/15 transition hover:bg-raised">Annuler</Link>
        <button
          disabled={pending}
          className="min-h-12 rounded-2xl bg-sky px-6 font-semibold text-canvas shadow-lg shadow-sky/25 outline-none transition focus-visible:ring-4 focus-visible:ring-sky/40 active:scale-95 disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer l'élève"}
        </button>
      </div>
    </form>
  );
}
