"use client";

import { useRef, useState, useTransition } from "react";
import type { Role } from "@/core/domain/rbac/role";
import { ROLE_LABELS } from "@/core/domain/rbac/user-management";
import { LEVELS } from "@/core/domain/students/student";
import { ParentsFields, readParents } from "../../students/parents-fields";
import { createUser } from "./actions";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

interface Props {
  roles: Role[];
  students: { id: string; name: string }[];
}

export function CreateUser({ roles, students }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [role, setRole] = useState<Role>(roles.includes("TEACHER") ? "TEACHER" : (roles[0] ?? "TEACHER"));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState(false);

  const close = () => {
    dialog.current?.close();
    setCreated(false);
    setError(null);
    setFieldErrors({});
  };

  return (
    <>
      <button
        onClick={() => dialog.current?.showModal()}
        className="min-h-11 rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
      >
        + Créer un compte
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/60"
      >
        {created ? (
          <div className="grid gap-4 p-6" role="status">
            <h2 className="text-lg font-semibold">Compte créé ✅</h2>
            <p className="text-sm text-ink/70">Communiquez le mot de passe provisoire de façon sécurisée.</p>
            <button onClick={close} className="w-fit rounded-2xl bg-accent px-5 py-2.5 font-medium text-canvas">Fermer</button>
          </div>
        ) : (
          <form
            action={(fd) =>
              start(async () => {
                setError(null);
                setFieldErrors({});
                const res = await createUser({
                  ...Object.fromEntries(fd),
                  classLevels: fd.getAll("classLevels"),
                  parents: role === "STUDENT" ? readParents(fd) : undefined,
                });
                if (!res.ok) {
                  setFieldErrors(res.error.fieldErrors ?? {});
                  return setError(res.error.message);
                }
                if (res.data.status === "email_taken") return setError("Cette adresse e-mail est déjà utilisée.");
                setCreated(true);
              })
            }
            className="grid gap-3 p-6 sm:grid-cols-2"
          >
            <h2 className="text-lg font-semibold sm:col-span-2">Nouveau compte</h2>

            <label className="grid gap-1 text-sm">Rôle
              <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
                {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Nom complet
              <input name="fullName" required maxLength={120} autoComplete="off" className={field} />
              {fieldErrors.fullName ? <span role="alert" className="text-xs text-red-300">Prénom et nom requis</span> : null}
            </label>
            <label className="grid gap-1 text-sm">E-mail
              <input name="email" type="email" required autoComplete="off" className={field} />
              {fieldErrors.email ? <span role="alert" className="text-xs text-red-300">E-mail invalide</span> : null}
            </label>
            <label className="grid gap-1 text-sm">Téléphone
              <input name="phone" type="tel" maxLength={30} className={field} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">Mot de passe provisoire (10 caractères min.)
              <input name="password" type="text" required minLength={10} maxLength={128} autoComplete="off" className={field} />
              {fieldErrors.password ? <span role="alert" className="text-xs text-red-300">10 caractères minimum</span> : null}
            </label>

            {role === "TEACHER" ? (
              <>
                <label className="grid gap-1 text-sm">Spécialité / matière
                  <input name="specialty" required maxLength={60} className={field} />
                </label>
                <fieldset className="grid gap-1 text-sm">
                  <legend className="mb-1">Classes attribuées</legend>
                  <div className="flex flex-wrap gap-2">
                    {LEVELS.map((l) => (
                      <label key={l} className="flex min-h-9 items-center gap-2 rounded-xl bg-canvas px-3 ring-1 ring-white/15">
                        <input type="checkbox" name="classLevels" value={l} /> {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : null}

            {role === "STUDENT" ? (
              <>
                <label className="grid gap-1 text-sm">Classe
                  <select name="level" required defaultValue="" className={field}>
                    <option value="" disabled>Choisir…</option>
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">Date de naissance
                  <input name="birthDate" type="date" required className={field} />
                </label>
                <label className="grid gap-1 text-sm sm:col-span-2">Adresse
                  <input name="address" required maxLength={200} className={field} />
                </label>
                <ParentsFields invalid={!!fieldErrors.parents} />
              </>
            ) : null}

            {role === "PARENT" ? (
              <label className="grid gap-1 text-sm sm:col-span-2">Élève concerné
                <select name="studentId" required defaultValue="" className={field}>
                  <option value="" disabled>Choisir un élève…</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            ) : null}

            {error ? <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button type="button" onClick={close} className="rounded-2xl px-5 py-2.5 text-ink/80 hover:bg-raised">Annuler</button>
              <button disabled={pending} className="rounded-2xl bg-accent px-5 py-2.5 font-medium text-canvas active:scale-95 disabled:opacity-60">
                {pending ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
