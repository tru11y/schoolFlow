"use client";

import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AssistantReply } from "@/core/domain/copilot/assistant";
import { ActionLinks } from "@/presentation/components/copilot-cards";

type Turn = { question: string; reply: AssistantReply | { error: string } };

const SUGGESTIONS = [
  "Quoi faire aujourd'hui ?",
  "Qui sont les 3 profs les moins assidus ?",
  "Relance pour les arriérés de la 3ème",
  "Quels élèves sont absents cette semaine ?",
  "Comment augmenter notre effectif en 4ème ?",
];

export function Chat({ initialQuestion }: { initialQuestion?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  /** Plain fetch with explicit handling: whatever happens, the turn gets an answer and the loader stops. */
  async function send(q: string): Promise<Turn["reply"]> {
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: AbortSignal.timeout(35_000),
      });
      if (res.redirected) return { error: "Session expirée. Reconnectez-vous puis réessayez." };
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { error?: string } | null)?.error;
        return { error: message ?? `Le service a répondu avec une erreur (${res.status}).` };
      }
      return data as AssistantReply;
    } catch {
      return { error: "Impossible de joindre l'assistant (connexion ou délai dépassé). Réessayez dans un instant." };
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 2 || pending) return;
    setDraft("");
    setPending(true);
    try {
      const reply = await send(q);
      setTurns((t) => [...t, { question: q, reply }]);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (initialQuestion && !asked.current) {
      asked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the ?q= deep link
  }, [initialQuestion]);

  useEffect(() => {
    // Block body on purpose: an effect must return nothing or a cleanup function, never scrollIntoView's result.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-5" aria-live="polite">
        {turns.length === 0 && !pending ? (
          <div className="rounded-3xl bg-surface p-6 shadow-soft">
            <p className="flex items-center gap-2 font-medium"><Sparkles className="size-5 text-accent" aria-hidden />Copilote SchoolFlow</p>
            <p className="mt-2 text-sm text-ink/70">Posez une question sur les impayés, l&apos;assiduité, les professeurs ou la croissance de l&apos;effectif.</p>
          </div>
        ) : null}
        {turns.map((t, i) => (
          <div key={i} className="grid gap-3">
            <p className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-canvas">{t.question}</p>
            <div className="max-w-full rounded-3xl rounded-bl-lg bg-surface p-5 shadow-soft">
              {"error" in t.reply ? (
                <p className="text-danger">{t.reply.error}</p>
              ) : (
                <>
                  <p>{t.reply.text}</p>
                  <ul className="mt-3 grid gap-2">
                    {t.reply.items.map((item, j) => (
                      <li key={j} className="rounded-2xl bg-canvas/60 p-3 ring-1 ring-ink/10">
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.detail ? <p className="text-sm text-ink/70">{item.detail}</p> : null}
                        <ActionLinks links={item.links} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        ))}
        {pending ? <p className="text-sm text-ink/70" role="status">Analyse en cours…</p> : null}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => void ask(s)} disabled={pending} className="rounded-full bg-surface px-3 py-1.5 text-xs ring-1 ring-ink/15 transition hover:bg-raised active:scale-95 disabled:opacity-60">
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
        className="sticky bottom-4 flex items-center gap-2 rounded-3xl bg-surface p-2 shadow-soft ring-1 ring-ink/15"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={300}
          placeholder="Posez votre question…"
          aria-label="Votre question"
          className="h-11 min-w-0 flex-1 bg-transparent px-3 outline-none"
        />
        <button disabled={pending || draft.trim().length < 2} aria-label="Envoyer" className="grid size-11 place-items-center rounded-2xl bg-accent text-canvas transition active:scale-95 disabled:opacity-50">
          <Send className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
