import { describe, expect, it } from "vitest";
import { canWriteScope, dayLabel, teacherScopes, timeRange } from "./logbook";

describe("teacherScopes", () => {
  it("merges scheduled slots and class x specialty assignments without duplicates", () => {
    const scopes = teacherScopes(
      [{ level: "3e", subject: "Mathématiques" }, { level: "3e", subject: "Mathématiques" }, { level: null, subject: "Libre" }],
      ["3e", "4e"],
      "Mathématiques",
    );
    expect(scopes).toEqual([
      { level: "3e", subject: "Mathématiques" },
      { level: "4e", subject: "Mathématiques" },
    ]);
  });

  it("restricts writing to assigned classes and subjects", () => {
    const scopes = teacherScopes([{ level: "3e", subject: "Français" }], [], null);
    expect(canWriteScope(scopes, "3e", "Français")).toBe(true);
    expect(canWriteScope(scopes, "4e", "Français")).toBe(false);
    expect(canWriteScope(scopes, "3e", "SVT")).toBe(false);
  });
});

describe("labels", () => {
  it("labels days relative to today", () => {
    expect(dayLabel("2026-10-03", "2026-10-03")).toBe("Aujourd'hui");
    expect(dayLabel("2026-10-02", "2026-10-03")).toBe("Hier");
    expect(dayLabel("2026-09-28", "2026-10-03")).toBe("28/09/2026");
    expect(dayLabel("2026-02-28", "2026-03-01")).toBe("Hier");
  });

  it("formats time ranges", () => {
    expect(timeRange("10:00", "12:00")).toBe("10h-12h");
    expect(timeRange("08:30", "10:00")).toBe("8h30-10h");
    expect(timeRange(null, "10:00")).toBe("");
  });
});
