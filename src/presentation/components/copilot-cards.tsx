import Link from "next/link";
import type { ActionCard, ActionLink, CardCategory } from "@/core/domain/copilot/types";

const CATEGORY: Record<CardCategory, { label: string; tone: string }> = {
  FINANCE: { label: "Urgence financière", tone: "bg-mint/15 text-mint" },
  DISCIPLINE: { label: "Discipline", tone: "bg-danger/15 text-danger" },
  PEDAGOGY: { label: "Relance pédagogique", tone: "bg-lilac/15 text-lilac" },
  GROWTH: { label: "Croissance", tone: "bg-sky/15 text-sky" },
};

const chip =
  "inline-flex min-h-9 items-center rounded-full bg-accent/15 px-3 text-xs font-medium text-accent outline-none ring-1 ring-accent/30 transition hover:bg-accent/25 focus-visible:ring-2 active:scale-95";

export function ActionLinks({ links }: { links: ActionLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((l) =>
        l.kind === "page" ? (
          <Link key={l.label} href={l.href} className={chip}>{l.label}</Link>
        ) : (
          <a key={l.label} href={l.href} target={l.kind === "whatsapp" ? "_blank" : undefined} rel="noopener noreferrer" className={chip}>{l.label}</a>
        ),
      )}
    </div>
  );
}

export function TodayPanel({ cards }: { cards: ActionCard[] }) {
  return (
    <section aria-labelledby="today-title" className="mt-6 rounded-3xl bg-surface p-6 shadow-soft">
      <h2 id="today-title" className="text-lg font-semibold">✨ Quoi faire aujourd&apos;hui</h2>
      {cards.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70">Rien d&apos;urgent : paiements, assiduité et cahiers de texte sont à jour.</p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {cards.map((c) => (
            <li key={c.id} className="rounded-2xl bg-canvas/60 p-4 ring-1 ring-ink/10">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY[c.category].tone}`}>
                {c.priority === 1 ? "Urgent · " : ""}{CATEGORY[c.category].label}
              </span>
              <p className="mt-2 font-medium">{c.title}</p>
              <p className="text-sm text-ink/70">{c.detail}</p>
              <ActionLinks links={c.links} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
