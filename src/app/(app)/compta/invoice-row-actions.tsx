"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type RefObject } from "react";
import { adjustInvoice, deleteInvoice, type InvoiceChangeResult } from "./actions";

export interface InvoiceView {
  id: string;
  /** Major units of the school currency */
  amount: number;
  paidCents: number;
  label: string;
}

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";
const iconButton =
  "min-h-9 min-w-9 rounded-xl px-2 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95";

type Response = { ok: true; data: InvoiceChangeResult } | { ok: false; error: { message: string; fieldErrors?: unknown } };

interface Props {
  invoice: InvoiceView;
  currency: string;
  exponent: number;
}

export function InvoiceRowActions({ invoice, currency, exponent }: Props) {
  const router = useRouter();
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fmt = (cents: number) => `${(cents / 10 ** exponent).toLocaleString("fr-FR")} ${currency}`;

  const close = (ref: RefObject<HTMLDialogElement | null>) => {
    setError(null);
    ref.current?.close();
  };

  const errorOf = (res: Response): string | null => {
    if (!res.ok) return res.error.fieldErrors ? "Vérifiez les champs." : res.error.message;
    if (res.data.status === "not_found") return "Facture introuvable ou déjà supprimée.";
    if (res.data.status === "has_payments") return `Un paiement de ${fmt(res.data.paidCents)} est déjà imputé. Annulez-le d'abord.`;
    if (res.data.status === "below_paid") return `Montant inférieur au déjà payé (${fmt(res.data.paidCents)}).`;
    return null;
  };

  const submit = (ref: RefObject<HTMLDialogElement | null>, run: () => Promise<Response>) =>
    start(async () => {
      setError(null);
      const message = errorOf(await run());
      if (message) return setError(message);
      close(ref);
      router.refresh();
    });

  return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => editDialog.current?.showModal()} aria-label="Ajuster le solde" title="Ajuster le solde" className={iconButton}>✏️</button>
      <button onClick={() => deleteDialog.current?.showModal()} aria-label="Annuler / Supprimer la facture" title="Annuler / Supprimer la facture" className={iconButton}>🗑️</button>

      <dialog
        ref={editDialog}
        onClick={(e) => e.target === editDialog.current && close(editDialog)}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          className="grid gap-4 p-6"
          action={(fd) => submit(editDialog, () => adjustInvoice({ ...Object.fromEntries(fd), invoiceId: invoice.id }))}
        >
          <h2 className="text-lg font-semibold">Ajuster le solde</h2>
          <p className="text-sm text-ink/70">{invoice.label}</p>
          <label className="grid gap-1 text-sm">Nouveau montant dû ({currency})
            <input name="amount" type="number" min={0} step="any" required defaultValue={invoice.amount} className={field} />
          </label>
          <p className="text-xs text-ink/70">Déjà payé : {fmt(invoice.paidCents)}. Mettre à 0 remet le reliquat à zéro.</p>
          <label className="grid gap-1 text-sm">Motif de l&apos;ajustement
            <input name="reason" required maxLength={200} placeholder="Ex. retard fictif de configuration" className={field} />
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => close(editDialog)} className="min-h-11 rounded-2xl bg-raised px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent">Annuler</button>
            <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={deleteDialog}
        onClick={(e) => e.target === deleteDialog.current && close(deleteDialog)}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          className="grid gap-4 p-6"
          action={(fd) => submit(deleteDialog, () => deleteInvoice({ invoiceId: invoice.id, reason: fd.get("reason") }))}
        >
          <h2 className="text-lg font-semibold">Supprimer la facture</h2>
          <p className="text-sm">Annuler définitivement {invoice.label} ? Le reliquat de l&apos;élève sera ramené à 0.</p>
          <label className="grid gap-1 text-sm">Motif
            <input name="reason" required maxLength={200} className={field} />
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => close(deleteDialog)} className="min-h-11 rounded-2xl bg-raised px-5 outline-none focus-visible:ring-2 focus-visible:ring-accent">Annuler</button>
            <button disabled={pending} className="min-h-11 rounded-2xl bg-danger px-5 font-medium text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60">
              {pending ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
