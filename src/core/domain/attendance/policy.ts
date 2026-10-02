import { toMinutes } from "../students/timetable";

export const SCHOOL_TZ = "Europe/Paris";

export interface LocalParts {
  /** ISO weekday: 1 = Monday ... 7 = Sunday */
  weekday: number;
  minutes: number;
  /** YYYY-MM-DD in the school timezone */
  date: string;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function localParts(now: Date, tz: string = SCHOOL_TZ): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    weekday: WEEKDAYS[parts.weekday ?? ""] ?? 1,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export interface SlotRef {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
}

export type TimingState = "IN_SLOT" | "OUT_OF_SLOT" | "NO_SLOT";

export interface Timing<S extends SlotRef = SlotRef> {
  state: TimingState;
  /** Slot in progress, else the closest slot of the day, else null. */
  slot: S | null;
  /** Minutes after the slot end (> 0) or before its start (< 0); 0 in slot; null without slot. */
  offsetMinutes: number | null;
}

export function evaluateTiming<S extends SlotRef>(slots: S[], now: Date, tz: string = SCHOOL_TZ): Timing<S> {
  const { weekday, minutes } = localParts(now, tz);
  const today = slots.filter((s) => s.weekday === weekday);

  const current = today.find((s) => toMinutes(s.startTime) <= minutes && minutes < toMinutes(s.endTime));
  if (current) return { state: "IN_SLOT", slot: current, offsetMinutes: 0 };

  const offset = (s: S) => {
    const start = toMinutes(s.startTime);
    const end = toMinutes(s.endTime);
    return minutes >= end ? minutes - end : minutes - start; // negative = before the slot
  };
  const nearest = [...today].sort((a, b) => Math.abs(offset(a)) - Math.abs(offset(b)))[0];
  return nearest
    ? { state: "OUT_OF_SLOT", slot: nearest, offsetMinutes: offset(nearest) }
    : { state: "NO_SLOT", slot: null, offsetMinutes: null };
}

/** Only teachers are bound to their schedule; admins may take attendance at any time. */
export function isOverdueSubmission(role: string, timing: Timing): boolean {
  return role === "TEACHER" && timing.state !== "IN_SLOT";
}
