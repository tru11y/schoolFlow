"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordPayment } from "./actions";
import type { PayerSummary } from "./summaries";

const METHODS = [
  { value: "CASH", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "TRANSFER", label: "Virement" },
] as const;

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

interface Props {
  students: PayerSummary[];
  currency: string;
  defaultDescription: string;
  preselect?: string;
  onDone?: () => void;
}

const fmt = (n: number, currency: string) => `${n.toLocaleString("fr-FR")} ${currency}`;

export function PaymentForm({ students, currency, defaultDescription, preselect, onDone }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [studentId, setStudentId] = useState(preselect ?? "");
  const [amount, setAmount] = useState(() => {
    const s = students.find((x) => x.id === preselect);
    return s ? String(s.balance > 0 ? s.balance : (s.fee ?? "")) : "";
  });
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; href?: string } | null>(null);

  const student = students.find((s) => s.id === studentId);

  const pick = (id: string) => {
    setStudentId(id);
    setMessage(null);
    const s = students.find((x) => x.id === id);
    if (s) setAmount(String(s.balance > 0 ? s.balance : (s.fee ?? "")));
  };

  return (
    <form
      action={(fd) =>
        start(async () => {
          setMessage(null);
          const res = await recordPayment(Object.fromEntries(fd));
          if (!res.ok) return setMessage({ tone: "error", text: res.error.fieldErrors ? "Vérifiez les champs." : res.error.message });
          if (res.data.status === "nothing_due") {
            return setMessage({ tone: "error", text: "Aucun solde à régler : générez d'abord les échéances du mois." });
          }
          if (res.data.status === "overpay") {
            const left = students.find((s) => s.id === studentId);
            return setMessage({
              tone: "error",
              text: `Montant supérieur au solde dû${left ? ` (${fmt(left.balance, currency)})` : ""}.`,
            });
          }
          const href = `/compta/receipt/${res.data.paymentId}`;
          setMessage({ tone: "ok", text: "Paiement enregistré. Le reçu PDF se télécharge.", href });
          const a = document.createElement("a");
          a.href = href;
          a.download = "";
          a.click();
          router.refresh();
          onDone?.();
        })
      }
      className="grid gap-4"
    >
      <label className="grid gap-1 text-sm">Élève
        <select name="studentId" required value={studentId} onChange={(e) => pick(e.target.value)} className={field}>
          <option value="" disabled>Choisir un élève…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.level ? ` · ${s.level}` : ""}</option>)}
        </select>
      </label>

      {student ? (
        <dl className="grid grid-cols-3 gap-2 text-sm" aria-live="polite">
          <div className="rounded-2xl bg-sky/10 p-3"><dt className="text-xs text-ink/70">Mensualité</dt><dd className="font-semibold">{student.fee == null ? "—" : fmt(student.fee, currency)}</dd></div>
          <div className="rounded-2xl bg-mint/10 p-3"><dt className="text-xs text-ink/70">Solde dû</dt><dd className="font-semibold">{fmt(student.balance, currency)}</dd></div>
          <div className={`rounded-2xl p-3 ${student.arrears > 0 ? "bg-red-400/10" : "bg-canvas"}`}><dt className="text-xs text-ink/70">Arriérés</dt><dd className="font-semibold">{fmt(student.arrears, currency)}</dd></div>
        </dl>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Montant versé ({currency})
          <input name="amount" type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-sm">Mode de règlement
          <select name="method" defaultValue="CASH" className={field}>
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm">Description
        <input name="description" required maxLength={160} defaultValue={defaultDescription} className={field} />
      </label>

      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-red-300" : "text-mint"}`}>
          {message.text}{" "}
          {message.href ? <a href={message.href} className="underline">Télécharger le reçu</a> : null}
        </p>
      ) : null}

      <button disabled={pending} className="min-h-12 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
        {pending ? "Enregistrement…" : "Valider & Générer le Reçu PDF"}
      </button>
    </form>
  );
}
