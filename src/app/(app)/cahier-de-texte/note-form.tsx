"use client";

import { useRef, useState, useTransition } from "react";
import { createHomework } from "./actions";

export function NoteForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const field =
    "w-full rounded-2xl bg-canvas px-4 py-3 outline-none ring-1 ring-white/15 focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <form
      ref={ref}
      action={(fd) =>
        start(async () => {
          const res = await createHomework({ title: fd.get("title"), content: fd.get("content") });
          setError(res.ok ? null : res.error.message);
          if (res.ok) ref.current?.reset();
        })
      }
      className="grid gap-3"
    >
      <label className="grid gap-1 text-sm">
        Titre
        <input name="title" required maxLength={120} className={field} />
      </label>
      <label className="grid gap-1 text-sm">
        Contenu
        <textarea name="content" required rows={5} maxLength={5000} className={field} />
      </label>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <button
        disabled={pending}
        className="justify-self-end rounded-2xl bg-accent px-5 py-3 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60"
      >
        {pending ? "Publication…" : "Publier"}
      </button>
    </form>
  );
}
