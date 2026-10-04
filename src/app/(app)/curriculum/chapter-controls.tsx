"use client";

import { useState, useTransition } from "react";
import { createChapter, setChapterDone } from "./actions";

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

export function ChapterCheck({ id, title, position, done, canWrite }: { id: string; title: string; position: number; done: boolean; canWrite: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <label className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 ${canWrite ? "cursor-pointer hover:bg-raised/60" : ""}`}>
      <input
        type="checkbox"
        checked={done}
        disabled={!canWrite || pending}
        onChange={(e) =>
          start(async () => {
            const res = await setChapterDone({ id, done: e.target.checked });
            setError(res.ok ? null : res.error.message);
          })
        }
        className="size-5 accent-[oklch(0.85_0.1_165)]"
      />
      <span className={done ? "text-ink/60 line-through" : ""}>
        <span className="mr-2 text-ink/60">Ch. {position}</span>
        {title}
      </span>
      {error ? <span role="alert" className="ml-auto text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function AddChapter({ subjects, levels }: { subjects: string[]; levels: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await createChapter(Object.fromEntries(fd));
          setError(res.ok ? null : res.error.message);
        })
      }
      className="grid gap-3 sm:grid-cols-[8rem_1fr_2fr_auto] sm:items-end"
    >
      <label className="grid gap-1 text-sm">Classe
        <select name="level" required defaultValue={levels[0]} className={field}>{levels.map((l) => <option key={l} value={l}>{l}</option>)}</select>
      </label>
      <label className="grid gap-1 text-sm">Matière
        <input name="subject" required maxLength={60} list="subjects" className={field} />
        <datalist id="subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label className="grid gap-1 text-sm">Titre du chapitre
        <input name="title" required maxLength={160} className={field} />
      </label>
      <button disabled={pending} className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas active:scale-95 disabled:opacity-60">
        {pending ? "…" : "Ajouter"}
      </button>
      {error ? <p role="alert" className="text-sm text-danger sm:col-span-4">{error}</p> : null}
    </form>
  );
}
