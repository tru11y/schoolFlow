"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteThread, renameThread } from "./thread-actions";

export interface ThreadGroup {
  label: string;
  threads: { id: string; title: string }[];
}

export function ThreadPanel({ groups, activeId }: { groups: ThreadGroup[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rename = (id: string, current: string) => {
    const title = window.prompt("Nouveau titre de la conversation", current)?.trim();
    if (!title || title === current) return;
    start(async () => {
      const res = await renameThread({ id, title });
      setError(res.ok ? null : "Titre invalide (80 caractères maximum).");
      if (res.ok) router.refresh();
    });
  };

  const remove = (id: string, title: string) => {
    if (!window.confirm(`Supprimer la conversation « ${title} » ?`)) return;
    start(async () => {
      const res = await deleteThread({ id });
      setError(res.ok ? null : "Suppression impossible.");
      if (!res.ok) return;
      if (id === activeId) router.push(`/ai-assistant?n=${Date.now()}`);
      else router.refresh();
    });
  };

  return (
    <nav aria-label="Historique des conversations" className="grid content-start gap-4">
      <button
        type="button"
        onClick={() => router.push(`/ai-assistant?n=${Date.now()}`)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
      >
        <Plus className="size-4" aria-hidden />Nouvelle conversation
      </button>

      {groups.length === 0 ? <p className="px-1 text-sm text-ink/70">Aucune conversation pour le moment.</p> : null}
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="grid gap-1">
          <h3 className="px-2 text-xs font-medium uppercase tracking-wide text-ink/60">{g.label}</h3>
          <ul className="grid gap-0.5">
            {g.threads.map((t) => (
              <li key={t.id} className={`group flex items-center gap-1 rounded-xl ${t.id === activeId ? "bg-accent/15 ring-1 ring-accent/30" : "hover:bg-raised"}`}>
                <Link
                  href={`/ai-assistant?thread=${t.id}`}
                  aria-current={t.id === activeId ? "page" : undefined}
                  className="min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t.title}
                </Link>
                <button type="button" disabled={pending} onClick={() => rename(t.id, t.title)} aria-label={`Renommer « ${t.title} »`} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/60 outline-none hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button type="button" disabled={pending} onClick={() => remove(t.id, t.title)} aria-label={`Supprimer « ${t.title} »`} className="mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-danger/80 outline-none hover:bg-surface hover:text-danger focus-visible:ring-2 focus-visible:ring-accent">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {error ? <p role="alert" className="px-1 text-sm text-danger">{error}</p> : null}
    </nav>
  );
}
