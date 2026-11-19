import { WEEKDAYS } from "@/core/domain/students/student";
import { hourRange, subjectTone, toMinutes } from "@/core/domain/students/timetable";

export interface GridSlot {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  room?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
}

const HOUR_PX = 60;

/**
 * Grille hebdomadaire en lecture seule, positionnée à l'heure. Composant
 * présentationnel pur (aucun hook) : utilisable en Server Component, sur la page
 * admin, la page publique partagée et l'impression PDF.
 */
export function TimetableGrid({ slots, className = "" }: { slots: GridSlot[]; className?: string }) {
  const days = slots.some((s) => s.weekday >= 7) ? 7 : slots.some((s) => s.weekday >= 6) ? 6 : 5;
  const { from, to } = hourRange(slots);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3.5rem repeat(${days}, minmax(0, 1fr))` }}>
        <div />
        {WEEKDAYS.slice(0, days).map((d) => (
          <div key={d} className="pb-3 text-center text-[13px] font-semibold tracking-tight text-ink/80">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}

        {/* Colonne des heures */}
        <div className="relative" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-2.5 -translate-y-1/2 text-[11px] font-medium tabular-nums text-ink/40"
              style={{ top: i * HOUR_PX }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {Array.from({ length: days }, (_, d) => (
          <div
            key={d}
            className="relative rounded-2xl"
            style={{
              height: hours.length * HOUR_PX,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--grid-line, rgb(128 128 128 / 0.12)) ${HOUR_PX - 1}px, var(--grid-line, rgb(128 128 128 / 0.12)) ${HOUR_PX}px)`,
            }}
          >
            {slots
              .filter((s) => s.weekday === d + 1)
              .map((s) => {
                const top = ((toMinutes(s.startTime) - from * 60) / 60) * HOUR_PX;
                const height = ((toMinutes(s.endTime) - toMinutes(s.startTime)) / 60) * HOUR_PX;
                return (
                  <div
                    key={s.id}
                    className={`absolute inset-x-1.5 overflow-hidden rounded-2xl px-2.5 py-1.5 text-left text-xs shadow-sm ring-1 ring-black/5 ${subjectTone(s.subject)}`}
                    style={{ top: top + 2, height: Math.max(height - 3, 22) }}
                  >
                    <span className="block truncate text-[13px] font-semibold leading-tight">{s.subject}</span>
                    <span className="block truncate text-[11px] opacity-70">
                      {s.startTime}–{s.endTime}
                      {s.room ? ` · ${s.room}` : ""}
                    </span>
                    {height > 58 && s.teacherName ? (
                      <span className="block truncate text-[11px] opacity-70">{s.teacherName}</span>
                    ) : null}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pastille de légende par matière (couleur = subjectTone). */
export function SubjectLegend({ subjects }: { subjects: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {subjects.map((s) => (
        <span key={s} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${subjectTone(s)}`}>
          <span className="size-1.5 rounded-full bg-current" />
          {s}
        </span>
      ))}
    </div>
  );
}
