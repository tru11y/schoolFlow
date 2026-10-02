"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState, useTransition } from "react";
import { takeAttendance } from "./actions";

type Status = "PRESENT" | "ABSENT" | "LATE";

export interface TimingView {
  tone: "green" | "orange";
  text: string;
  warn: string | null;
}

interface Props {
  level: string;
  timing: TimingView;
  students: { id: string; name: string; status: Status }[];
}

const OPTIONS: { value: Status; label: string; icon: string; on: string }[] = [
  { value: "PRESENT", label: "Présent", icon: "✓", on: "bg-mint text-canvas" },
  { value: "ABSENT", label: "Absent", icon: "✕", on: "bg-red-300 text-canvas" },
  { value: "LATE", label: "Retard", icon: "⏱", on: "bg-amber-300 text-canvas" },
];

export function TakeForm({ level, timing, students }: Props) {
  const [values, setValues] = useState<Record<string, Status>>(Object.fromEntries(students.map((s) => [s.id, s.status])));
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = (status: Status) => Object.values(values).filter((v) => v === status).length;
  const set = (id: string, status: Status) => {
    setDone(null);
    setValues((v) => ({ ...v, [id]: status }));
  };

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await takeAttendance({
        level,
        records: Object.entries(values).map(([studentId, status]) => ({ studentId, status })),
      });
      if (res.ok) setDone(res.data.isOverdue ? "Appel enregistré (signalé hors créneau)" : "Appel enregistré");
      else setError(res.error.message);
    });

  return (
    <div className="grid gap-4">
      <div
        role="status"
        className={`rounded-2xl px-4 py-3 text-sm font-medium ${
          timing.tone === "green" ? "bg-mint/15 text-mint" : "bg-peach/15 text-peach"
        }`}
      >
        <span aria-hidden className="mr-2">●</span>
        {timing.text}
        {timing.warn ? <p className="mt-1 font-normal opacity-90">{timing.warn}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/70" aria-live="polite">
          {count("PRESENT")} présent{count("PRESENT") > 1 ? "s" : ""} · {count("ABSENT")} absent{count("ABSENT") > 1 ? "s" : ""} · {count("LATE")} en retard
        </p>
        <button
          type="button"
          onClick={() => students.forEach((s) => set(s.id, "PRESENT"))}
          className="min-h-11 rounded-2xl bg-raised px-4 text-sm outline-none transition hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
        >
          Tous présents
        </button>
      </div>

      <ul className="grid gap-3">
        {students.map((s) => (
          <li key={s.id} className="grid gap-2 rounded-2xl bg-canvas p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="px-1 font-medium">{s.name}</span>
            <div role="radiogroup" aria-label={`Présence de ${s.name}`} className="grid grid-cols-3 gap-1.5">
              {OPTIONS.map((o) => {
                const selected = values[s.id] === o.value;
                return (
                  <motion.button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => set(s.id, o.value)}
                    className={`min-h-11 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                      selected ? o.on : "bg-surface text-ink/80"
                    }`}
                  >
                    <span aria-hidden className="mr-1">{o.icon}</span>
                    {o.label}
                  </motion.button>
                );
              })}
            </div>
          </li>
        ))}
        {students.length === 0 ? <li className="text-ink/70">Aucun élève actif dans cette classe.</li> : null}
      </ul>

      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}

      <motion.button
        type="button"
        disabled={pending || students.length === 0}
        onClick={submit}
        whileTap={{ scale: 0.97 }}
        animate={done ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        className={`min-h-14 rounded-2xl px-6 text-lg font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60 ${
          done ? "bg-mint text-canvas" : "bg-accent text-canvas"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={pending ? "p" : done ? "d" : "i"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="inline-block"
          >
            {pending ? "Enregistrement…" : done ? `✓ ${done}` : "Valider l'appel"}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
