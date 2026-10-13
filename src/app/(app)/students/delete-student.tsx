"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteStudent } from "./actions";

/** Trash button + confirmation dialog. `redirectTo` is where to go once the student is gone (profile page). */
export function DeleteStudentButton({ id, name, redirectTo, compact = false }: { id: string; name: string; redirectTo?: string; compact?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await deleteStudent({ id });
      if (!res.ok) return setError("Suppression impossible.");
      dialog.current?.close();
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); dialog.current?.showModal(); }}
        aria-label={`Supprimer l'élève ${name}`}
        className={`inline-flex min-h-9 items-center gap-2 rounded-xl text-sm text-danger outline-none transition hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger active:scale-95 ${compact ? "px-2" : "px-4 py-2 ring-1 ring-danger/30"}`}
      >
        <Trash2 className="size-4" aria-hidden />
        {compact ? <span className="sr-only">Supprimer</span> : "Supprimer l'élève"}
      </button>
      <dialog ref={dialog} aria-labelledby={`del-${id}`} className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-surface p-6 text-ink shadow-soft backdrop:bg-black/50">
        <h2 id={`del-${id}`} className="text-lg font-semibold">Supprimer l&apos;élève</h2>
        <p className="mt-3 text-sm text-ink/80">
          Êtes-vous sûr de vouloir supprimer l&apos;élève {name} ? Cette action déplacera l&apos;élève vers la Corbeille : il ne pourra plus se connecter,
          ses paiements et son historique sont conservés, et vous pourrez le restaurer.
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-2xl px-4 text-sm ring-1 ring-ink/15 hover:bg-raised">Annuler</button>
          <button type="button" disabled={pending} onClick={confirm} className="min-h-10 rounded-2xl bg-danger px-4 text-sm font-semibold text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
            {pending ? "…" : "Déplacer vers la Corbeille"}
          </button>
        </div>
      </dialog>
    </>
  );
}
