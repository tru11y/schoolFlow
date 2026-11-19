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
    <>
      <TimetableAgenda slots={slots} days={days} className={`sm:hidden print:hidden ${className}`} />
      <div className={`hidden overflow-x-auto sm:block print:block ${className}`}>
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
                const span = Math.max(height - 3, 22);
                const compact = span < 44; // moins d'une heure : tout sur peu de place
                return (
                  <div
                    key={s.id}
                    className={`absolute inset-x-1.5 flex flex-col gap-0.5 overflow-hidden rounded-2xl px-2.5 py-1.5 text-left shadow-sm ring-1 ring-black/5 dark:ring-white/10 ${compact ? "justify-center" : ""} ${subjectTone(s.subject)}`}
                    style={{ top: top + 2, height: span }}
                    title={s.subject}
                  >
                    <span
                      className={`font-semibold leading-tight tracking-tight ${compact ? "truncate text-[12px]" : "break-words text-[13px]"}`}
                    >
                      {s.subject}
                    </span>
                    <span className="block truncate text-[11px] tabular-nums opacity-70">
                      {s.startTime}–{s.endTime}
                      {s.room ? ` · ${s.room}` : ""}
                    </span>
                    {span > 72 && s.teacherName ? (
                      <span className="block truncate text-[11px] opacity-70">{s.teacherName}</span>
                    ) : null}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

/** Vue mobile : agenda vertical groupé par jour (la grille horaire scrolle mal sur petit écran). */
function TimetableAgenda({ slots, days, className = "" }: { slots: GridSlot[]; days: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {Array.from({ length: days }, (_, d) => {
        const daySlots = slots
          .filter((s) => s.weekday === d + 1)
          .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
        return (
          <section key={d}>
            <h3 className="mb-2 text-[13px] font-semibold tracking-tight text-ink/80">{WEEKDAYS[d]}</h3>
            {daySlots.length ? (
              <ul className="flex flex-col gap-2">
                {daySlots.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 ring-black/5 dark:ring-white/10 ${subjectTone(s.subject)}`}
                  >
                    <span className="w-14 shrink-0 pt-0.5 text-[11px] font-medium tabular-nums leading-tight opacity-70">
                      {s.startTime}
                      <br />
                      {s.endTime}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[14px] font-semibold leading-tight tracking-tight">{s.subject}</span>
                      {s.room || s.teacherName ? (
                        <span className="mt-0.5 block text-[12px] opacity-70">
                          {[s.room, s.teacherName].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink/40">—</p>
            )}
          </section>
        );
      })}
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
