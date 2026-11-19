"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type RefObject } from "react";
import { deletePayment, updatePayment, type PaymentChangeResult } from "./actions";

export interface PaymentView {
  id: string;
  /** Major units of the school currency */
  amount: number;
  method: "CASH" | "MOBILE_MONEY" | "TRANSFER" | "CHEQUE";
  description: string;
  /** YYYY-MM-DD */
  paidAt: string;
  reference: string | null;
}

const METHODS = [
  { value: "CASH", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "TRANSFER", label: "Virement" },
  { value: "CHEQUE", label: "Chèque" },
] as const;

const REASONS = ["Frais d'inscription", "Scolarité mensuelle"] as const;

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";
const iconButton =
  "min-h-9 min-w-9 rounded-xl px-2 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95";

type Response = { ok: true; data: PaymentChangeResult } | { ok: false; error: { message: string; fieldErrors?: unknown } };

interface Props {
  payment: PaymentView;
  currency: string;
  /** Decimal digits of the school currency (0 for FCFA). */
  exponent: number;
}

export function PaymentRowActions({ payment, currency, exponent }: Props) {
  const router = useRouter();
  const editDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fmt = (n: number) => `${n.toLocaleString("fr-FR")} ${currency}`;

  const close = (ref: RefObject<HTMLDialogElement | null>) => {
    setError(null);
    ref.current?.close();
  };

  const errorOf = (res: Response): string | null => {
    if (!res.ok) return res.error.fieldErrors ? "Vérifiez les champs." : res.error.message;
    if (res.data.status === "not_found") return "Paiement introuvable ou déjà supprimé.";
    if (res.data.status === "duplicate_month") return `Un paiement existe déjà pour ce mois (${res.data.period}).`;
    if (res.data.status === "overpay") return `Montant supérieur au solde dû (${fmt(res.data.outstandingCents / 10 ** exponent)}).`;
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
      <button onClick={() => editDialog.current?.showModal()} aria-label="Modifier le paiement" title="Modifier le paiement" className={iconButton}>✏️</button>
      <button onClick={() => deleteDialog.current?.showModal()} aria-label="Supprimer le paiement" title="Supprimer le paiement" className={iconButton}>🗑️</button>

      <dialog
        ref={editDialog}
        onClick={(e) => e.target === editDialog.current && close(editDialog)}
        className="m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          className="grid gap-4 p-6"
          action={(fd) => submit(editDialog, () => updatePayment({ ...Object.fromEntries(fd), paymentId: payment.id }))}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Modifier le paiement</h2>
            <button type="button" onClick={() => close(editDialog)} aria-label="Fermer" className="min-h-9 rounded-xl px-3 hover:bg-raised">✕</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Montant versé ({currency})
              <input name="amount" type="number" min={0} step="any" required defaultValue={payment.amount} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Mode de règlement
              <select name="method" defaultValue={payment.method} className={field}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Date de versement
              <input name="paidAt" type="date" required defaultValue={payment.paidAt} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Référence du reçu
              <input name="reference" maxLength={80} defaultValue={payment.reference ?? ""} className={field} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">Motif / libellé
            <input name="description" list={`reasons-${payment.id}`} required maxLength={160} defaultValue={payment.description} className={field} />
            <datalist id={`reasons-${payment.id}`}>{REASONS.map((r) => <option key={r} value={r} />)}</datalist>
          </label>
          <label className="grid gap-1 text-sm">Motif de la modification
            <input name="reason" required maxLength={200} placeholder="Ex. erreur de saisie du montant" className={field} />
          </label>
          <p className="text-xs text-ink/70">Le solde de l&apos;élève est recalculé et le reçu PDF certifié est régénéré.</p>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <button disabled={pending} className="min-h-12 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
            {pending ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </dialog>

      <dialog
        ref={deleteDialog}
        onClick={(e) => e.target === deleteDialog.current && close(deleteDialog)}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          className="grid gap-4 p-6"
          action={(fd) => submit(deleteDialog, () => deletePayment({ paymentId: payment.id, reason: fd.get("reason") }))}
        >
          <h2 className="text-lg font-semibold">Supprimer le paiement</h2>
          <p className="text-sm">
            Êtes-vous sûr de vouloir annuler/supprimer ce paiement de {fmt(payment.amount)} ? Le solde de l&apos;élève sera automatiquement réajusté.
          </p>
          <label className="grid gap-1 text-sm">Motif de l&apos;annulation
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
