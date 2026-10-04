"use client";

import { useRef, useState, useTransition } from "react";
import { WEEKDAYS } from "@/core/domain/students/student";
import { hourRange, subjectTone, toMinutes } from "@/core/domain/students/timetable";

const DURATIONS = [{ label: "45 min", min: 45 }, { label: "1 h", min: 60 }, { label: "1 h 30", min: 90 }, { label: "2 h", min: 120 }];
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
import { deleteSlot, saveSlot } from "../actions";

export interface SlotView {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  room: string | null;
  teacherId: string | null;
  teacherName: string | null;
  scope: "class" | "student";
  chapterId: string | null;
  chapterLabel: string | null;
}

interface Props {
  studentId: string;
  level: string | null;
  slots: SlotView[];
  teachers: { id: string; name: string }[];
  chapters: { id: string; label: string }[];
}

const HOUR_PX = 56;
const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

export function Timetable({ studentId, level, slots, teachers, chapters }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<SlotView | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("10:00");

  const days = slots.some((s) => s.weekday >= 6) ? 6 : 5;
  const { from, to } = hourRange(slots);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  const open = (slot: SlotView | null) => {
    setEditing(slot);
    setStartTime(slot?.startTime ?? "08:30");
    setEndTime(slot?.endTime ?? "10:00");
    setError(null);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/70">{level ? `Classe ${level}` : "Sans classe"} · cliquez sur un créneau pour le modifier</p>
        <button
          onClick={() => open(null)}
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
        >
          + Ajouter un créneau
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[680px]" style={{ gridTemplateColumns: `3rem repeat(${days}, minmax(0, 1fr))` }}>
          <div />
          {WEEKDAYS.slice(0, days).map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-medium text-ink/70">{d}</div>
          ))}

          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-ink/60" style={{ top: i * HOUR_PX }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {Array.from({ length: days }, (_, d) => (
            <div
              key={d}
              className="relative border-l border-ink/10"
              style={{
                height: hours.length * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(255 255 255 / 0.08) ${HOUR_PX - 1}px, rgb(255 255 255 / 0.08) ${HOUR_PX}px)`,
              }}
            >
              {slots
                .filter((s) => s.weekday === d + 1)
                .map((s) => {
                  const top = ((toMinutes(s.startTime) - from * 60) / 60) * HOUR_PX;
                  const height = ((toMinutes(s.endTime) - toMinutes(s.startTime)) / 60) * HOUR_PX;
                  return (
                    <button
                      key={s.id}
                      onClick={() => open(s)}
                      aria-label={`${s.subject}, ${WEEKDAYS[d]} de ${s.startTime} à ${s.endTime}`}
                      className={`absolute inset-x-1 overflow-hidden rounded-xl border-l-4 border-current px-2 py-1 text-left text-xs outline-none transition hover:brightness-125 focus-visible:ring-2 focus-visible:ring-accent ${subjectTone(s.subject)}`}
                      style={{ top: top + 1, height: height - 2 }}
                    >
                      <span className="block truncate font-semibold">{s.subject}</span>
                      <span className="block truncate opacity-80">{s.startTime}–{s.endTime}{s.room ? ` · ${s.room}` : ""}</span>
                      {height > 60 && s.teacherName ? <span className="block truncate opacity-80">{s.teacherName}</span> : null}
                      {height > 80 && s.chapterLabel ? <span className="block truncate opacity-70">{s.chapterLabel}</span> : null}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-full max-w-md rounded-3xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          key={editing?.id ?? "new"}
          action={(fd) =>
            start(async () => {
              const res = await saveSlot({ ...Object.fromEntries(fd), id: editing?.id, studentId });
              if (res.ok) return close();
              setError(res.error.fieldErrors ? "Vérifiez les champs (heures, matière)." : res.error.message);
            })
          }
          className="grid gap-3 p-6"
        >
          <h3 className="text-lg font-semibold">{editing ? "Modifier le créneau" : "Nouveau créneau"}</h3>
          <label className="grid gap-1 text-sm">Matière
            <input name="subject" required maxLength={60} defaultValue={editing?.subject} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Jour
            <select name="weekday" defaultValue={editing?.weekday ?? 1} className={field}>
              {WEEKDAYS.slice(0, 6).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">Début
              <input name="startTime" type="time" step={300} required value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Fin
              <input name="endTime" type="time" step={300} required value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Durée du créneau">
            <span className="text-xs text-ink/70">Durée :</span>
            {DURATIONS.map((d) => (
              <button
                key={d.min}
                type="button"
                onClick={() => setEndTime(hhmm(Math.min(toMinutes(startTime) + d.min, 23 * 60 + 59)))}
                className="min-h-9 rounded-xl bg-canvas px-3 text-xs ring-1 ring-ink/15 outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm">Professeur
            <select name="teacherId" defaultValue={editing?.teacherId ?? ""} className={field}>
              <option value="">—</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Chapitre du programme
            <select name="chapterId" defaultValue={editing?.chapterId ?? ""} className={field}>
              <option value="">—</option>
              {chapters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Salle
            <input name="room" maxLength={30} defaultValue={editing?.room ?? ""} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Appliquer à
            <select name="scope" defaultValue={editing?.scope ?? "class"} className={field}>
              <option value="class" disabled={!level}>Toute la classe {level ?? ""}</option>
              <option value="student">Cet élève uniquement</option>
            </select>
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="mt-2 flex items-center justify-between gap-3">
            {editing ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteSlot({ id: editing.id, studentId });
                    if (res.ok) close();
                    else setError(res.error.message);
                  })
                }
                className="rounded-2xl px-4 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={close} className="rounded-2xl px-4 py-2 text-sm text-ink/80 hover:bg-raised">Annuler</button>
              <button disabled={pending} className="rounded-2xl bg-accent px-5 py-2 text-sm font-medium text-canvas active:scale-95 disabled:opacity-60">
                {pending ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </div>
  );
}
