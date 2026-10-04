"use client";

import { useRef, useState, useTransition } from "react";
import { periodLabel } from "@/core/domain/finance/billing";
import { generateInvoices } from "./actions";
import { PaymentForm } from "./payment-form";
import type { PayerSummary } from "./summaries";

export function PayDialog(props: { students: PayerSummary[]; currency: string; defaultDescription: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        onClick={() => dialog.current?.showModal()}
        className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
      >
        + Enregistrer un paiement
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/60"
      >
        <div className="grid gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Encaissement rapide</h2>
            <button onClick={() => dialog.current?.close()} aria-label="Fermer" className="min-h-9 rounded-xl px-3 hover:bg-raised">✕</button>
          </div>
          <PaymentForm {...props} onDone={() => dialog.current?.close()} />
        </div>
      </dialog>
    </>
  );
}

export function GenerateButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="grid justify-items-start gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await generateInvoices({});
            if (!res.ok) return setMessage(res.error.message);
            const r = res.data;
            setMessage(
              `${periodLabel(r.period)} : ${r.created} échéance(s) créée(s), ${r.alreadyBilled} déjà facturée(s)` +
                (r.skippedNoFee ? `, ${r.skippedNoFee} sans tarif` : "") +
                (r.carriedOverCents ? `, arriérés reportés : ${r.carriedOverCents.toLocaleString("fr-FR")}` : ""),
            );
          })
        }
        className="min-h-11 rounded-2xl bg-raised px-5 font-medium outline-none ring-1 ring-ink/15 transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60"
      >
        {pending ? "Génération…" : "Générer les échéances mensuelles"}
      </button>
      {message ? <p role="status" className="text-xs text-ink/80">{message}</p> : null}
    </div>
  );
}
