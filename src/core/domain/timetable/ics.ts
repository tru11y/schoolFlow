import { toMinutes } from "../students/timetable";

export interface IcsSlot {
  id: string;
  weekday: number; // 1 = lundi ... 7 = dimanche
  startTime: string; // HH:MM
  endTime: string;
  subject: string;
  room?: string | null;
  teacherName?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Échappe le texte selon RFC 5545 (virgule, point-virgule, antislash, saut de ligne). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function stamp(d: Date, hhmm: string): string {
  const [h = "0", m = "0"] = hhmm.split(":");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Number(h))}${pad(Number(m))}00`;
}

/** Lundi (00:00 local) de la semaine contenant `ref`. */
export function weekMonday(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const delta = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - delta);
  return d;
}

/**
 * Construit un calendrier iCal (VEVENT récurrents hebdomadaires) à partir des
 * créneaux. Heures « flottantes » (locales), compatibles Apple Calendar / Google.
 */
export function buildIcs(opts: { calendarName: string; slots: IcsSlot[]; anchorMonday: Date }): string {
  const { calendarName, slots, anchorMonday } = opts;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SchoolFlow//Timetable//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  const byday = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const dtstamp = stamp(new Date(), "00:00");
  for (const s of slots) {
    if (toMinutes(s.endTime) <= toMinutes(s.startTime)) continue;
    const day = new Date(anchorMonday);
    day.setDate(day.getDate() + (s.weekday - 1));
    const desc = [s.teacherName, s.room].filter(Boolean).join(" · ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@schoolflow`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(day, s.startTime)}`,
      `DTEND:${stamp(day, s.endTime)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday[s.weekday - 1]}`,
      `SUMMARY:${esc(s.subject)}`,
    );
    if (s.room) lines.push(`LOCATION:${esc(s.room)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
