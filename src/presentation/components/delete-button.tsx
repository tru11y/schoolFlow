"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

type Result = { ok: true } | { ok: false; error: { message: string } };

interface Props {
  id: string;
  /** Server action performing the soft delete. */
  action: (input: { id: string }) => Promise<Result>;
  /** What is being deleted, e.g. "ce chapitre". */
  label: string;
  /** Where to go once deleted (detail pages); defaults to refreshing the current list. */
  redirectTo?: string;
}

/** 🗑️ button + confirmation dialog. Every deletion is a soft delete: items go to /admin/trash. */
export function DeleteButton({ id, action, label, redirectTo }: Props) {
  const router = useRouter();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await action({ id });
      if (!res.ok) return setError(res.error.message);
      dialog.current?.close();
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); dialog.current?.showModal(); }}
        aria-label={`Supprimer ${label}`}
        className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-sm text-danger outline-none transition hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger active:scale-95"
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="sr-only">Supprimer</span>
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-surface p-6 text-ink shadow-soft backdrop:bg-black/50">
        <h2 id={titleId} className="text-lg font-semibold">Confirmer la suppression</h2>
        <p className="mt-3 text-sm text-ink/80">
          Voulez-vous vraiment supprimer {label} ? Il sera déplacé vers la Corbeille et pourra être restauré.
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
