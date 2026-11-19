"use client";

import { useMemo, useState, useTransition } from "react";
import { SubjectLegend, TimetableGrid, type GridSlot } from "@/presentation/components/timetable-grid";
import { TimetableExportActions } from "@/presentation/components/timetable-export-actions";
import { createShareLink, revokeShareLink } from "./actions";

export interface LevelData {
  name: string;
  slots: GridSlot[];
  token: string | null;
}

const pill =
  "min-h-9 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95";
const action =
  "inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60";

export function TimetableAdmin({ levels }: { levels: LevelData[] }) {
  const [active, setActive] = useState(levels[0]?.name ?? "");
  const current = levels.find((l) => l.name === active) ?? levels[0];

  if (!current) {
    return <p className="rounded-3xl bg-surface p-6 text-ink/60 shadow-soft">Aucun créneau de classe. Importez votre emploi du temps ci-dessus.</p>;
  }

  return (
    <div>
      {/* Sélecteur de niveau — contrôle segmenté */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-full bg-canvas p-1.5 ring-1 ring-ink/10 print-hide">
        {levels.map((l) => (
          <button
            key={l.name}
            onClick={() => setActive(l.name)}
            aria-current={l.name === current.name}
            className={`${pill} ${l.name === current.name ? "bg-accent text-canvas shadow-sm" : "text-ink/70 hover:text-ink"}`}
          >
            {l.name}
            <span className="ml-1.5 text-xs opacity-60">{l.slots.length}</span>
          </button>
        ))}
      </div>

      <LevelPanel key={current.name} level={current} />
    </div>
  );
}

function LevelPanel({ level }: { level: LevelData }) {
  const subjects = useMemo(() => [...new Set(level.slots.map((s) => s.subject))].sort(), [level.slots]);
  const captureId = `edt-capture-${level.name.replace(/\s+/g, "-")}`;
  const fileBase = `emploi-du-temps-${level.name.replace(/\s+/g, "-")}`;
  const csvHref = `/api/export/timetable?level=${encodeURIComponent(level.name)}`;
  const icsHref = `/api/timetable/ics?level=${encodeURIComponent(level.name)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print-hide">
        <ShareControl level={level.name} initialToken={level.token} />
        <TimetableExportActions captureId={captureId} fileBase={fileBase} icsHref={icsHref} csvHref={csvHref} />
      </div>

      {subjects.length ? <div className="mb-4"><SubjectLegend subjects={subjects} /></div> : null}

      <section id={captureId} className="rounded-3xl bg-surface p-4 shadow-soft sm:p-6">
        {level.slots.length ? (
          <TimetableGrid slots={level.slots} />
        ) : (
          <p className="py-10 text-center text-ink/60">Aucun créneau pour {level.name}.</p>
        )}
      </section>
    </div>
  );
}

function ShareControl({ level, initialToken }: { level: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/edt/${token}` : "";

  const create = () =>
    start(async () => {
      const res = await createShareLink({ level });
      if (res.ok) {
        setToken(res.data.token);
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/edt/${res.data.token}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* presse-papiers indisponible */ }
      }
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const revoke = () =>
    start(async () => {
      const res = await revokeShareLink({ level });
      if (res.ok) setToken(null);
    });

  if (!token) {
    return (
      <button onClick={create} disabled={pending} className={`${action} bg-surface`}>
        <span aria-hidden>🔗</span> {pending ? "…" : "Créer un lien de partage"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1 text-xs font-medium text-mint">
        <span className="size-1.5 rounded-full bg-current" /> Lien public actif
      </span>
      <button onClick={copy} className={`${action} bg-surface`}>
        <span aria-hidden>📋</span> {copied ? "Copié !" : "Copier le lien"}
      </button>
      <a href={url} target="_blank" rel="noreferrer" className={`${action} bg-surface`}>
        <span aria-hidden>↗</span> Ouvrir
      </a>
      <button onClick={revoke} disabled={pending} className={`${action} text-danger`}>
        {pending ? "…" : "Révoquer"}
      </button>
    </div>
  );
}
