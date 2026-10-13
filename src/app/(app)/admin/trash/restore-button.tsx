"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { restoreStudent } from "../../students/actions";

export function RestoreButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-label={`Restaurer ${name}`}
        onClick={() =>
          start(async () => {
            const res = await restoreStudent({ id });
            if (!res.ok) return setError("Restauration impossible.");
            router.refresh();
          })
        }
        className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-accent/15 px-3 text-sm font-medium text-accent outline-none ring-1 ring-accent/30 transition hover:bg-accent/25 focus-visible:ring-2 active:scale-95 disabled:opacity-60"
      >
        <RotateCcw className="size-4" aria-hidden />Restaurer
      </button>
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
    </span>
  );
}
