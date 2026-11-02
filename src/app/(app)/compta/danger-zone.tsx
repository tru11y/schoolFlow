"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { purgeTestData, type PurgeResult } from "./actions";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

type Response = { ok: true; data: PurgeResult } | { ok: false; error: { message: string; fieldErrors?: unknown } };

export function DangerZone() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const close = () => {
    setFeedback(null);
    dialog.current?.close();
  };

  const onSubmit = (fd: FormData) =>
    start(async () => {
      setFeedback(null);
      const res = (await purgeTestData(Object.fromEntries(fd))) as Response;
      if (!res.ok) {
        setFeedback({ tone: "error", message: res.error.fieldErrors ? "Vérifiez les champs." : res.error.message });
        return;
      }
      if (res.data.status === "tenant_missing") {
        setFeedback({ tone: "error", message: "École introuvable." });
        return;
      }
      setFeedback({
        tone: "ok",
        message: `Purgé : ${res.data.invoicesPurged} facture(s) et ${res.data.paymentsPurged} paiement(s) antérieurs au ${res.data.before}.`,
      });
      router.refresh();
    });

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-danger">Zone sensible · SUPER_ADMIN</h2>
      <div className="rounded-3xl border border-danger/30 bg-danger/5 p-5">
        <p className="mb-3 text-sm">
          Purger les factures et paiements de test saisis durant la configuration. Chaque suppression est tracée dans le journal d&apos;audit.
        </p>
        <button
          onClick={() => dialog.current?.showModal()}
          className="min-h-11 rounded-2xl bg-danger px-5 font-medium text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
        >
          Ajuster / Remettre à zéro le solde de démarrage
        </button>
      </div>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form className="grid gap-4 p-6" action={onSubmit}>
          <h2 className="text-lg font-semibold">Purger les données de test</h2>
          <p className="text-sm text-ink/80">
            Toutes les factures et paiements créés avant la date pivot seront soft-deletés. Les reliquats des élèves repartent de zéro.
          </p>
          <label className="grid gap-1 text-sm">Date pivot (exclue)
            <input name="before" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Motif
            <input name="reason" required maxLength={200} placeholder="Ex. nettoyage initial de configuration" className={field} />
          </label>
          {feedback ? (
            <p role="alert" className={`text-sm ${feedback.tone === "ok" ? "text-mint" : "text-danger"}`}>{feedback.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="min-h-11 rounded-2xl bg-raised px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent">Fermer</button>
            <button disabled={pending} className="min-h-11 rounded-2xl bg-danger px-5 font-medium text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60">
              {pending ? "Purge…" : "Confirmer la purge"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
