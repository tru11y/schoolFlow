export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMinutes = (hhmm: string): number => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

export interface SlotLike {
  weekday: number;
  startTime: string;
  endTime: string;
}

/** Visible hour range [from, to] covering all slots, clamped to 7h-21h (default 8h-18h). */
export function hourRange(slots: SlotLike[]): { from: number; to: number } {
  if (slots.length === 0) return { from: 8, to: 18 };
  const from = Math.floor(Math.min(...slots.map((s) => toMinutes(s.startTime))) / 60);
  const to = Math.ceil(Math.max(...slots.map((s) => toMinutes(s.endTime))) / 60);
  return { from: Math.max(7, Math.min(from, 8)), to: Math.min(21, Math.max(to, 18)) };
}

const PALETTE = ["bg-mint/20 text-mint", "bg-sky/20 text-sky", "bg-peach/20 text-peach", "bg-lilac/20 text-lilac"] as const;

/** Stable pastel color per subject. */
export function subjectTone(subject: string): string {
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
