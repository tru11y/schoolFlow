"use client";

import { Ban, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { setStudentActive } from "./actions";

/** Deactivate / reactivate a student (reversible, distinct from delete). Blocks login without removing the student. */
export function ToggleStudentActiveButton({ id, name, active, compact = false }: { id: string; name: string; active: boolean; compact?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await setStudentActive({ id, active: !active });
      if (!res.ok) return setError(active ? "Désactivation impossible." : "Réactivation impossible.");
      dialog.current?.close();
      router.refresh();
    });

  const Icon = active ? Ban : RotateCcw;
  const verb = active ? "Désactiver" : "Réactiver";
  const tone = active ? "text-warning hover:bg-warning/10 focus-visible:ring-warning" : "text-success hover:bg-success/10 focus-visible:ring-success";

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); dialog.current?.showModal(); }}
        aria-label={`${verb} l'élève ${name}`}
        className={`inline-flex min-h-9 items-center gap-2 rounded-xl text-sm outline-none transition focus-visible:ring-2 active:scale-95 ${tone} ${compact ? "px-2" : `px-4 py-2 ring-1 ${active ? "ring-warning/30" : "ring-success/30"}`}`}
      >
        <Icon className="size-4" aria-hidden />
        {compact ? <span className="sr-only">{verb}</span> : `${verb} l'élève`}
      </button>
      <dialog ref={dialog} aria-labelledby={`toggle-${id}`} className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-surface p-6 text-ink shadow-soft backdrop:bg-black/50">
        <h2 id={`toggle-${id}`} className="text-lg font-semibold">{verb} l&apos;élève</h2>
        <p className="mt-3 text-sm text-ink/80">
          {active
            ? `Désactiver ${name} ? L'élève ne pourra plus se connecter et ses sessions ouvertes seront fermées. Il reste dans la liste et vous pourrez le réactiver à tout moment.`
            : `Réactiver ${name} ? L'élève pourra de nouveau se connecter.`}
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-10 rounded-2xl px-4 text-sm ring-1 ring-ink/15 hover:bg-raised">Annuler</button>
          <button type="button" disabled={pending} onClick={confirm} className={`min-h-10 rounded-2xl px-4 text-sm font-semibold text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60 ${active ? "bg-warning" : "bg-success"}`}>
            {pending ? "…" : verb}
          </button>
        </div>
      </dialog>
    </>
  );
}
