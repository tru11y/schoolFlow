"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type RefObject } from "react";
import { WEEKDAYS } from "@/core/domain/students/student";
import { SubjectLegend, TimetableGrid, type GridSlot } from "@/presentation/components/timetable-grid";
import { TimetableExportActions } from "@/presentation/components/timetable-export-actions";
import { createShareLink, createSlot, deleteSlot, revokeShareLink, updateSlot } from "./actions";

export interface LevelData {
  name: string;
  slots: GridSlot[];
  token: string | null;
}
export interface TeacherOption {
  id: string;
  name: string;
}

const pill =
  "min-h-9 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-accent active:scale-95";
const action =
  "inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-none ring-1 ring-ink/15 transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95 disabled:opacity-60";
const field =
  "w-full rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none ring-1 ring-ink/15 focus-visible:ring-2 focus-visible:ring-accent";
const iconButton =
  "min-h-9 min-w-9 rounded-xl px-2 outline-none transition hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent active:scale-95";

interface AdminProps {
  levels: LevelData[];
  allLevels: string[];
  teachers: TeacherOption[];
}

export function TimetableAdmin({ levels, allLevels, teachers }: AdminProps) {
  // Tabs cover levels that already have slots plus any empty registered class.
  const tabNames = useMemo(() => {
    const names = new Set(levels.map((l) => l.name));
    return [...levels.map((l) => l.name), ...allLevels.filter((n) => !names.has(n))];
  }, [levels, allLevels]);
  const [active, setActive] = useState(tabNames[0] ?? "");
  const current = levels.find((l) => l.name === active) ?? { name: active, slots: [], token: null };

  if (!tabNames.length) {
    return <p className="rounded-3xl bg-surface p-6 text-ink/60 shadow-soft">Aucune classe enregistrée. Créez un niveau, puis ajoutez des créneaux.</p>;
  }

  return (
    <div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-full bg-canvas p-1.5 ring-1 ring-ink/10 print-hide">
        {tabNames.map((name) => {
          const count = levels.find((l) => l.name === name)?.slots.length ?? 0;
          return (
            <button
              key={name}
              onClick={() => setActive(name)}
              aria-current={name === active}
              className={`${pill} ${name === active ? "bg-accent text-canvas shadow-sm" : "text-ink/70 hover:text-ink"}`}
            >
              {name}
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <LevelPanel key={current.name} level={current} allLevels={allLevels} teachers={teachers} />
    </div>
  );
}

function LevelPanel({ level, allLevels, teachers }: { level: LevelData; allLevels: string[]; teachers: TeacherOption[] }) {
  const subjects = useMemo(() => [...new Set(level.slots.map((s) => s.subject))].sort(), [level.slots]);
  const sorted = useMemo(
    () => [...level.slots].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)),
    [level.slots],
  );
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

      <SlotEditor level={level.name} slots={sorted} allLevels={allLevels} teachers={teachers} />
    </div>
  );
}

function SlotEditor({ level, slots, allLevels, teachers }: { level: string; slots: GridSlot[]; allLevels: string[]; teachers: TeacherOption[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<GridSlot | null>(null);
  const days = slots.some((s) => s.weekday >= 7) ? 7 : slots.some((s) => s.weekday >= 6) ? 6 : 5;

  const open = (slot: GridSlot | null) => {
    setError(null);
    setEditing(slot);
    dialog.current?.showModal();
  };
  const close = () => {
    setError(null);
    setEditing(null);
    dialog.current?.close();
  };

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const base = {
        level: String(fd.get("level") ?? level),
        weekday: String(fd.get("weekday")),
        startTime: String(fd.get("startTime")),
        endTime: String(fd.get("endTime")),
        subject: String(fd.get("subject")),
        teacherId: String(fd.get("teacherId") ?? ""),
        room: String(fd.get("room") ?? ""),
      };
      const res = editing
        ? await updateSlot({ ...base, slotId: editing.id })
        : await createSlot(base);
      if (!res.ok) return setError(res.error.fieldErrors ? "Vérifiez les champs (heures au format HH:MM, fin après début)." : res.error.message);
      if (res.data.status === "not_found") return setError("Créneau introuvable.");
      close();
      router.refresh();
    });

  const remove = (slot: GridSlot) =>
    start(async () => {
      const res = await deleteSlot({ slotId: slot.id });
      if (res.ok) router.refresh();
    });

  const teacherName = (id?: string | null) => teachers.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="mt-6 print-hide">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Modifier les créneaux · {level}</h3>
        <button onClick={() => open(null)} className={`${action} bg-surface`}>
          <span aria-hidden>＋</span> Ajouter un créneau
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl bg-surface p-2 shadow-soft sm:p-4">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink/70">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Jour</th>
              <th scope="col" className="px-3 py-2 font-medium">Horaire</th>
              <th scope="col" className="px-3 py-2 font-medium">Matière</th>
              <th scope="col" className="px-3 py-2 font-medium">Enseignant</th>
              <th scope="col" className="px-3 py-2 font-medium">Salle</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-t border-ink/10">
                <td className="px-3 py-2">{WEEKDAYS[s.weekday - 1] ?? s.weekday}</td>
                <td className="px-3 py-2 tabular-nums">{s.startTime}–{s.endTime}</td>
                <td className="px-3 py-2">{s.subject}</td>
                <td className="px-3 py-2">{s.teacherName ?? teacherName(s.teacherId)}</td>
                <td className="px-3 py-2">{s.room ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => open(s)} aria-label="Modifier le créneau" title="Modifier" className={iconButton}>✏️</button>
                    <button onClick={() => remove(s)} disabled={pending} aria-label="Supprimer le créneau" title="Supprimer" className={`${iconButton} text-danger`}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {slots.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-ink/60">Aucun créneau. Cliquez « Ajouter un créneau ».</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-surface p-0 text-left text-ink shadow-soft backdrop:bg-black/60"
      >
        <form className="grid gap-4 p-6" action={submit}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editing ? "Modifier le créneau" : "Ajouter un créneau"}</h2>
            <button type="button" onClick={close} aria-label="Fermer" className="min-h-9 rounded-xl px-3 hover:bg-raised">✕</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">Classe
              <select name="level" defaultValue={level} className={field}>
                {[...new Set([level, ...allLevels])].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Jour
              <select name="weekday" defaultValue={editing?.weekday ?? 1} className={field}>
                {WEEKDAYS.slice(0, Math.max(days, 6)).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Début
              <input name="startTime" type="time" required defaultValue={editing?.startTime ?? "08:00"} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Fin
              <input name="endTime" type="time" required defaultValue={editing?.endTime ?? "09:00"} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Matière
              <input name="subject" required maxLength={60} defaultValue={editing?.subject ?? ""} className={field} />
            </label>
            <label className="grid gap-1 text-sm">Salle (optionnel)
              <input name="room" maxLength={40} defaultValue={editing?.room ?? ""} className={field} />
            </label>
          </div>
          <label className="grid gap-1 text-sm">Enseignant (optionnel)
            <select name="teacherId" defaultValue={editing?.teacherId ?? ""} className={field}>
              <option value="">— Aucun —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <button disabled={pending} className="min-h-12 rounded-2xl bg-accent px-5 font-medium text-canvas outline-none transition focus-visible:ring-2 focus-visible:ring-ink active:scale-95 disabled:opacity-60">
            {pending ? "Enregistrement…" : editing ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      </dialog>
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
