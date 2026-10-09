import { describe, expect, it } from "vitest";
import { competitorStats, feesText, mentioned, wantedLevel, type CompetitorView } from "./competitors";

const c = (id: string, name: string, area: string | null, fees: [string, number][]): CompetitorView => ({
  id, name, area, contact: null, offers: null, notes: null, fees: fees.map(([level, feeCents]) => ({ level, feeCents })),
});

const list = [
  c("1", "Centre Excellence", "Cocody", [["3e", 30_000], ["4e", 25_000]]),
  c("2", "Soutien Plus", "Marcory", [["3e", 20_000]]),
  c("3", "Réussite Académie", "Cocody", [["3e", 40_000], ["Tle", 50_000]]),
  c("4", "Prépa Yop", null, []),
];

describe("competitorStats", () => {
  it("computes min / median / max for a level", () => {
    expect(competitorStats("3e", list)).toEqual({ count: 3, min: 20_000, median: 30_000, max: 40_000 });
    expect(competitorStats("Tle", list)).toMatchObject({ count: 1, median: 50_000 });
  });

  it("averages the two middle values for an even count", () => {
    expect(competitorStats("3e", [...list, c("5", "X", null, [["3e", 50_000]])]).median).toBe(35_000);
  });

  it("is empty for unknown levels", () => {
    expect(competitorStats("6e", list).count).toBe(0);
    expect(competitorStats(null, list).count).toBe(0);
  });
});

describe("feesText", () => {
  it("lists fees in class order, or filters on one level", () => {
    expect(feesText(list[0]!, "FCFA")).toBe("4e : 25 000 FCFA · 3e : 30 000 FCFA");
    expect(feesText(list[0]!, "FCFA", "3e")).toBe("3e : 30 000 FCFA");
    expect(feesText(list[3]!, "FCFA")).toBe("aucun tarif renseigné");
  });
});

describe("question parsing", () => {
  it("finds competitors by name or area, accent-insensitive", () => {
    expect(mentioned("Compare avec le Centre Excellence", list).map((x) => x.id)).toEqual(["1"]);
    expect(mentioned("les tarifs à cocody", list).map((x) => x.id)).toEqual(["1", "3"]);
    expect(mentioned("reussite academie ?", list).map((x) => x.id)).toEqual(["3"]);
    expect(mentioned("bonjour", list)).toEqual([]);
  });

  it("detects the level asked about", () => {
    expect(wantedLevel("Compare nos tarifs de 3ème")).toBe("3e");
    expect(wantedLevel("tarifs en Terminale C")).toBe("Tle");
    expect(wantedLevel("la seconde")).toBe("2nde");
    expect(wantedLevel("tous les tarifs")).toBeNull();
  });
});
