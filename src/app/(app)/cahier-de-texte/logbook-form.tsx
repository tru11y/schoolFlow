"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { timeRange } from "@/core/domain/logbook/logbook";
import { WEEKDAYS } from "@/core/domain/students/student";
import { saveLogbookEntry } from "./actions";

export interface LogbookInitial {
  id?: string;
  level?: string;
  subject?: string;
  date?: string;
  slotId?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  content?: string;
  homework?: string;
  homeworkDue?: string;
  chapterId?: string;
}

interface Props {
  levels: string[];
  subjectsByLevel: Record<string, string[]>;
  slots: { id: string; level: string; subject: string; weekday: number; startTime: string; endTime: string }[];
  chapters: { id: string; level: string; subject: string; label: string }[];
  today: string;
  initial?: LogbookInitial;
  autoOpen: boolean;
}

const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";

export function LogbookForm({ levels, subjectsByLevel, slots, chapters, today, initial, autoOpen }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(initial?.level ?? levels[0] ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [slotId, setSlotId] = useState(initial?.slotId ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");

  useEffect(() => {
    if (autoOpen) dialog.current?.showModal();
  }, [autoOpen]);

  const subjects = subjectsByLevel[level] ?? [];
  const levelSlots = slots.filter((s) => s.level === level);
  const levelChapters = chapters.filter((c) => c.level === level && (!subject || c.subject === subject));

  const pickLevel = (value: string) => {
    setLevel(value);
    setSubject("");
    setSlotId("");
    setStartTime("");
    setEndTime("");
  };
  const pickSlot = (id: string) => {
    setSlotId(id);
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      setSubject(slot.subject);
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
    } else {
      setStartTime("");
      setEndTime("");
    }
  };
  const close = () => {
    dialog.current?.close();
    router.replace(level ? `/cahier-de-texte?level=${encodeURIComponent(level)}` : "/cahier-de-texte");
  };

  return (
    <>
      <button
        onClick={() => dialog.current?.showModal()}
        className="min-h-11 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95"
      >
        + Renseigner la séance
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/60"
      >
        <form
          action={(fd) =>
            start(async () => {
              setError(null);
              const res = await saveLogbookEntry({ ...Object.fromEntries(fd), id: initial?.id });
              if (res.ok) return close();
              setError(res.error.fieldErrors ? "Vérifiez les champs obligatoires." : res.error.message);
            })
          }
          className="grid gap-3 p-6 sm:grid-cols-2"
        >
          <h2 className="text-lg font-semibold sm:col-span-2">{initial?.id ? "Modifier la séance" : "Renseigner la séance"}</h2>

          <label className="grid gap-1 text-sm">Classe
            <select name="level" required value={level} onChange={(e) => pickLevel(e.target.value)} className={field}>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Matière
            <select name="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} className={field}>
              <option value="" disabled>Choisir…</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label className="grid gap-1 text-sm">Date
            <input name="date" type="date" required max={today} defaultValue={initial?.date ?? today} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Créneau de cours
            <select name="slotId" value={slotId} onChange={(e) => pickSlot(e.target.value)} className={field}>
              <option value="">Hors créneau</option>
              {levelSlots.map((s) => (
                <option key={s.id} value={s.id}>
                  {WEEKDAYS[s.weekday - 1]} {timeRange(s.startTime, s.endTime)} · {s.subject}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="startTime" value={startTime} />
          <input type="hidden" name="endTime" value={endTime} />

          <label className="grid gap-1 text-sm sm:col-span-2">Titre de la leçon
            <input name="title" required maxLength={160} defaultValue={initial?.title} className={field} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">Résumé du cours, notions abordées
            <textarea name="content" required rows={4} maxLength={5000} defaultValue={initial?.content} className={field} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">Devoirs à faire pour la séance suivante
            <textarea name="homework" rows={2} maxLength={2000} defaultValue={initial?.homework} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Date de rendu
            <input name="homeworkDue" type="date" min={today} defaultValue={initial?.homeworkDue} className={field} />
          </label>
          <label className="grid gap-1 text-sm">Chapitre du programme
            <select name="chapterId" defaultValue={initial?.chapterId ?? ""} key={`${level}-${subject}`} className={field}>
              <option value="">—</option>
              {levelChapters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="chapterDone" className="size-5 accent-[oklch(0.85_0.1_165)]" />
            Marquer le chapitre comme terminé
          </label>

          {error ? <p role="alert" className="text-sm text-danger sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" onClick={() => dialog.current?.close()} className="rounded-2xl px-5 py-2.5 text-ink/80 hover:bg-raised">Annuler</button>
            <button disabled={pending} className="rounded-2xl bg-accent px-5 py-2.5 font-medium text-canvas active:scale-95 disabled:opacity-60">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
