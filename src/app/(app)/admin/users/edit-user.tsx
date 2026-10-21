"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "./actions";

export interface EditableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

/** ✏️ button + dialog to edit a user's name, email and phone. */
export function EditUser({ user }: { user: EditableUser }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); dialog.current?.showModal(); }}
        aria-label={`Modifier ${user.firstName} ${user.lastName}`}
        className="min-h-9 rounded-xl px-2 text-sm outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
      >
        <span aria-hidden>✏️</span>
      </button>
      <dialog ref={dialog} className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-surface p-6 text-left text-ink shadow-soft backdrop:bg-black/50">
        <h2 className="text-lg font-semibold">Modifier l&apos;utilisateur</h2>
        <form
          action={(fd) =>
            start(async () => {
              const res = await updateUser({ id: user.id, ...Object.fromEntries(fd) });
              if (!res.ok) return setError(res.error.message);
              dialog.current?.close();
              router.refresh();
            })
          }
          className="mt-4 grid gap-3"
        >
          <label className="grid gap-1 text-sm">Prénom<input name="firstName" required maxLength={60} defaultValue={user.firstName} className={field} /></label>
          <label className="grid gap-1 text-sm">Nom<input name="lastName" required maxLength={60} defaultValue={user.lastName} className={field} /></label>
          <label className="grid gap-1 text-sm">E-mail<input name="email" type="email" required maxLength={254} defaultValue={user.email} className={field} /></label>
          <label className="grid gap-1 text-sm">Téléphone<input name="phone" maxLength={30} defaultValue={user.phone ?? ""} className={field} /></label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="mt-2 flex justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-2xl px-4 text-sm ring-1 ring-ink/15 hover:bg-raised">Annuler</button>
            <button disabled={pending} className="min-h-10 rounded-2xl bg-accent px-4 text-sm font-semibold text-canvas active:scale-95 disabled:opacity-60">{pending ? "…" : "Enregistrer"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
