import { describe, expect, it } from "vitest";
import { groupThreadsByAge, threadTitleSchema, titleFrom } from "./threads";

const now = new Date("2026-10-12T12:00:00Z");
const at = (iso: string, id = iso) => ({ id, title: id, updatedAt: new Date(iso) });

describe("titleFrom", () => {
  it("keeps short questions, collapses whitespace and cuts long ones on a word", () => {
    expect(titleFrom("  Quoi   faire\naujourd'hui ?  ")).toBe("Quoi faire aujourd'hui ?");
    const long = titleFrom("Que dois-je faire par rapport à la concurrence pour attirer plus d'élèves de Terminale cette année");
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(61);
    expect(titleFrom("   ")).toBe("Nouvelle conversation");
  });
});

describe("groupThreadsByAge", () => {
  it("groups by calendar day, most recent first, and omits empty groups", () => {
    const groups = groupThreadsByAge(
      [at("2026-10-12T08:00:00Z", "today"), at("2026-10-11T20:00:00Z", "yesterday"), at("2026-10-07T10:00:00Z", "week"), at("2026-09-20T10:00:00Z", "month"), at("2026-06-01T10:00:00Z", "old"), at("2026-10-12T11:00:00Z", "today-2")],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Aujourd'hui", "Hier", "7 derniers jours", "30 derniers jours", "Plus ancien"]);
    expect(groups[0]!.threads.map((t) => t.id)).toEqual(["today-2", "today"]);
    expect(groupThreadsByAge([at("2026-10-12T08:00:00Z")], now).map((g) => g.label)).toEqual(["Aujourd'hui"]);
  });
});

describe("threadTitleSchema", () => {
  it("rejects blank and over-long titles", () => {
    expect(threadTitleSchema.safeParse("  ").success).toBe(false);
    expect(threadTitleSchema.safeParse("x".repeat(81)).success).toBe(false);
    expect(threadTitleSchema.parse("  Concurrence  ")).toBe("Concurrence");
  });
});
