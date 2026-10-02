import { describe, expect, it } from "vitest";
import { TIME_RE, hourRange, subjectTone, toMinutes } from "./timetable";

describe("timetable helpers", () => {
  it("validates HH:MM", () => {
    expect(TIME_RE.test("08:30")).toBe(true);
    expect(TIME_RE.test("24:00")).toBe(false);
    expect(TIME_RE.test("8:30")).toBe(false);
    expect(toMinutes("10:15")).toBe(615);
  });

  it("computes a clamped hour range", () => {
    expect(hourRange([])).toEqual({ from: 8, to: 18 });
    expect(hourRange([{ weekday: 1, startTime: "09:00", endTime: "20:30" }])).toEqual({ from: 8, to: 21 });
    expect(hourRange([{ weekday: 1, startTime: "05:00", endTime: "10:00" }])).toEqual({ from: 7, to: 18 });
  });

  it("gives a stable tone per subject", () => {
    expect(subjectTone("Maths")).toBe(subjectTone("Maths"));
  });
});
