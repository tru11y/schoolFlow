"use client";

import { useState, useTransition } from "react";
import { markInvoicePaid } from "./actions";

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await markInvoicePaid({ invoiceId });
            setError(res.ok ? null : res.error.message);
          })
        }
        className="rounded-2xl bg-mint px-4 py-2 text-sm font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60"
      >
        {pending ? "…" : "Encaisser"}
      </button>
      {error ? <span role="alert" className="text-xs text-red-300">{error}</span> : null}
    </span>
  );
}
