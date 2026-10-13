"use client";

import { Bot, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AssistantReply } from "@/core/domain/copilot/assistant";
import { ActionLinks } from "@/presentation/components/copilot-cards";

export type Turn = { question: string; reply: AssistantReply | { error: string } };

const SUGGESTIONS = [
  "Quoi faire aujourd'hui ?",
  "Liste des concurrents et comparaison de nos tarifs",
  "Qui sont les 3 profs les moins assidus ?",
  "Relance pour les arriérés de la 3ème",
  "Quels élèves sont absents cette semaine ?",
  "Comment augmenter notre effectif en 4ème ?",
];

export function Chat({ initialQuestion, threadId: initialThreadId, initialTurns, initials = "" }: { initialQuestion?: string; threadId?: string | undefined; initialTurns?: Turn[] | undefined; initials?: string }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns ?? []);
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  /** First answer of a new conversation creates the thread: keep its id and refresh the history panel. */
  function adopt(id: unknown) {
    if (typeof id !== "string" || id === threadId) return;
    setThreadId(id);
    router.refresh();
  }

  /** Plain fetch with explicit handling: whatever happens, the turn gets an answer and the loader stops. */
  async function send(q: string): Promise<Turn["reply"]> {
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, threadId }),
        signal: AbortSignal.timeout(35_000),
      });
      if (res.redirected) return { error: "Session expirée. Reconnectez-vous puis réessayez." };
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (data as { error?: string } | null)?.error;
        return { error: message ?? `Le service a répondu avec une erreur (${res.status}).` };
      }
      const { threadId: id, ...reply } = data as AssistantReply & { threadId?: string };
      adopt(id);
      return reply;
    } catch {
      return { error: "Impossible de joindre l'assistant (connexion ou délai dépassé). Réessayez dans un instant." };
    }
  }

  /** Detailed web (OSINT) analysis of one competitor: appended to the conversation like any other answer. */
  async function runOsint(competitor: { id: string; name: string }) {
    if (pending) return;
    setPending(true);
    try {
      let reply: Turn["reply"];
      try {
        const res = await fetch("/api/ai/osint", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ competitorId: competitor.id, threadId }),
          signal: AbortSignal.timeout(58_000),
        });
        const data: unknown = await res.json().catch(() => null);
        if (res.ok) adopt((data as { threadId?: string } | null)?.threadId);
        reply = res.ok
          ? { intent: "ai", text: String((data as { text?: string }).text ?? ""), items: [] }
          : { error: (data as { error?: string } | null)?.error ?? `Le service a répondu avec une erreur (${res.status}).` };
      } catch {
        reply = { error: "Impossible de joindre l'analyse OSINT (connexion ou délai dépassé). Réessayez dans un instant." };
      }
      setTurns((t) => [...t, { question: `Analyse OSINT détaillée : ${competitor.name}`, reply }]);
    } finally {
      setPending(false);
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
    if (initialQuestion && !asked.current && !initialTurns) {
      asked.current = true;
      void ask(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the ?q= deep link
  }, [initialQuestion]);

  useEffect(() => {
    // Block body on purpose: an effect must return nothing or a cleanup function, never scrollIntoView's result.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, pending]);

  const botAvatar = (
    <div aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/25">
      <Sparkles className="size-4" />
    </div>
  );

  return (
    <section aria-label="Copilote SchoolFlow" className="flex h-full min-h-[32rem] w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-ink/10">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"><Bot className="size-4" /></div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Copilote SchoolFlow</h2>
            <p className="truncate text-xs text-ink/70">Impayés, assiduité, enseignants, concurrence et croissance de l&apos;effectif.</p>
          </div>
        </div>
        <span className="hidden shrink-0 rounded-md bg-mint/10 px-2 py-0.5 text-[11px] font-medium text-mint ring-1 ring-mint/25 sm:inline">Réservé au SuperAdmin</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-4" aria-live="polite">
          <div className="flex items-start gap-3">
            {botAvatar}
            <p className="max-w-2xl rounded-2xl rounded-tl-none bg-canvas/60 p-3.5 text-sm leading-relaxed ring-1 ring-ink/10">
              Bonjour ! Je peux analyser les impayés, suivre l&apos;assiduité, comparer vos tarifs à ceux des concurrents et préparer des relances WhatsApp ou SMS.
            </p>
          </div>
          {turns.map((t, i) => (
            <div key={i} className="grid gap-3">
              <div className="flex items-start justify-end gap-3">
                <p className="max-w-[85%] rounded-2xl rounded-tr-none bg-accent p-3.5 text-sm text-canvas">{t.question}</p>
                <div aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-lilac text-xs font-bold text-canvas">{initials || "·"}</div>
              </div>
              <div className="flex items-start gap-3">
                {botAvatar}
                <div className="min-w-0 max-w-full flex-1 rounded-2xl rounded-tl-none bg-canvas/60 p-4 ring-1 ring-ink/10">
                  {"error" in t.reply ? (
                    <p className="text-sm text-danger">{t.reply.error}</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-line text-sm leading-relaxed">{t.reply.text}</p>
                      <ul className="mt-3 grid gap-2">
                        {t.reply.items.map((item, j) => (
                          <li key={j} className="rounded-xl bg-surface p-3 ring-1 ring-ink/10">
                            <p className="text-sm font-medium">{item.title}</p>
                            {item.detail ? <p className="text-sm text-ink/70">{item.detail}</p> : null}
                            <ActionLinks links={item.links} />
                          </li>
                        ))}
                      </ul>
                      {t.reply.osint?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {t.reply.osint.map((c, _i, all) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => void runOsint(c)}
                              disabled={pending}
                              className="min-h-9 rounded-lg bg-accent/15 px-3 text-xs font-medium text-accent outline-none ring-1 ring-accent/30 transition hover:bg-accent/25 focus-visible:ring-2 active:scale-95 disabled:opacity-60"
                            >
                              🔎 Lancer une analyse OSINT détaillée{all.length > 1 ? ` · ${c.name}` : ""}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {pending ? <p className="pl-11 text-sm text-ink/70" role="status">Analyse en cours…</p> : null}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 overflow-x-auto border-t border-ink/10 bg-canvas/30 px-4 py-2" aria-label="Suggestions">
        <div className="flex w-max items-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => setDraft(s)} disabled={pending} className="whitespace-nowrap rounded-full bg-surface px-3 py-1 text-[11px] ring-1 ring-ink/15 transition hover:bg-raised active:scale-95 disabled:opacity-60">
              {s}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(draft); }} className="shrink-0 border-t border-ink/10 bg-surface p-3">
        <div className="relative flex items-center">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={300}
            placeholder="Posez votre question sur les impayés, la concurrence ou la croissance…"
            aria-label="Votre question"
            className="h-12 w-full rounded-xl bg-canvas/70 pl-4 pr-14 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button disabled={pending || draft.trim().length < 2} aria-label="Envoyer" className="absolute right-2 grid size-9 place-items-center rounded-lg bg-accent text-canvas transition active:scale-95 disabled:opacity-50">
            <Send className="size-4" aria-hidden />
          </button>
        </div>
      </form>
    </section>
  );
}
