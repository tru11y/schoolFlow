import { describe, expect, it } from "vitest";
import { buildSchedule } from "./student";

describe("buildSchedule", () => {
  it("sums to the total, first installment takes the remainder", () => {
    const s = buildSchedule(10000, 3, new Date("2026-10-01T00:00:00Z"));
    expect(s.map((x) => x.amountCents)).toEqual([3334, 3333, 3333]);
    expect(s.reduce((a, x) => a + x.amountCents, 0)).toBe(10000);
  });

  it("spaces due dates monthly", () => {
    const s = buildSchedule(300, 3, new Date("2026-10-05T00:00:00Z"));
    expect(s.map((x) => x.dueDate.toISOString().slice(0, 10))).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
  });
});
