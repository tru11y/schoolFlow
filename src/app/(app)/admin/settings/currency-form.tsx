"use client";

import { useState, useTransition } from "react";
import { CURRENCIES, type CurrencyCode } from "@/core/domain/finance/money";
import { updateSchoolSettings } from "./actions";

export function CurrencyForm({ current }: { current: CurrencyCode }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await updateSchoolSettings({ currency: fd.get("currency") });
          setMessage(
            res.ok
              ? "Devise enregistrée"
              : res.error.code === "FORBIDDEN"
                ? "Changement refusé : des factures existent avec un nombre de décimales différent."
                : res.error.message,
          );
        })
      }
      className="flex flex-wrap items-end gap-3"
    >
      <label className="grid gap-1 text-sm">Devise de l&apos;établissement
        <select
          name="currency"
          defaultValue={current}
          className="min-w-64 rounded-2xl bg-canvas px-4 py-2.5 outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
        >
          {Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
        </select>
      </label>
      <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas active:scale-95 disabled:opacity-60">
        {pending ? "…" : "Enregistrer"}
      </button>
      {message ? <p role="status" className="w-full text-sm text-ink/80">{message}</p> : null}
    </form>
  );
}
