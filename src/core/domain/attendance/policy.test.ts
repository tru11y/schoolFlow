import { describe, expect, it } from "vitest";
import { evaluateTiming, isOverdueSubmission, localParts } from "./policy";

// 2026-10-05 is a Monday. 10:30 Paris (CEST, UTC+2) = 08:30 UTC.
const monday1030 = new Date("2026-10-05T08:30:00Z");
const slot = (id: string, start: string, end: string, weekday = 1) => ({ id, weekday, startTime: start, endTime: end, subject: "Maths" });

describe("localParts", () => {
  it("uses the school timezone, including across midnight", () => {
    expect(localParts(monday1030)).toEqual({ weekday: 1, minutes: 630, date: "2026-10-05" });
    expect(localParts(new Date("2026-10-05T22:30:00Z"))).toMatchObject({ weekday: 2, date: "2026-10-06", minutes: 30 });
  });
});

describe("evaluateTiming", () => {
  it("detects the slot in progress (end exclusive)", () => {
    expect(evaluateTiming([slot("a", "10:00", "12:00")], monday1030)).toMatchObject({ state: "IN_SLOT", offsetMinutes: 0 });
    expect(evaluateTiming([slot("a", "09:00", "10:30")], monday1030).state).toBe("OUT_OF_SLOT");
  });

  it("reports positive offset after the slot and negative before it", () => {
    expect(evaluateTiming([slot("a", "08:00", "10:00")], monday1030)).toMatchObject({ state: "OUT_OF_SLOT", offsetMinutes: 30 });
    expect(evaluateTiming([slot("a", "11:00", "12:00")], monday1030)).toMatchObject({ state: "OUT_OF_SLOT", offsetMinutes: -30 });
  });

  it("picks the closest slot of the day and ignores other days", () => {
    const t = evaluateTiming([slot("far", "07:00", "08:00"), slot("near", "11:00", "12:00"), slot("other", "10:00", "12:00", 2)], monday1030);
    expect(t.slot?.id).toBe("near");
  });

  it("returns NO_SLOT without a slot today", () => {
    expect(evaluateTiming([slot("a", "10:00", "12:00", 3)], monday1030)).toEqual({ state: "NO_SLOT", slot: null, offsetMinutes: null });
  });
});

describe("isOverdueSubmission", () => {
  const out = evaluateTiming([slot("a", "08:00", "10:00")], monday1030);
  const inSlot = evaluateTiming([slot("a", "10:00", "12:00")], monday1030);
  it("flags teachers outside their slot only", () => {
    expect(isOverdueSubmission("TEACHER", out)).toBe(true);
    expect(isOverdueSubmission("TEACHER", inSlot)).toBe(false);
    expect(isOverdueSubmission("SCHOOL_ADMIN", out)).toBe(false);
    expect(isOverdueSubmission("SUPER_ADMIN", out)).toBe(false);
  });
});
