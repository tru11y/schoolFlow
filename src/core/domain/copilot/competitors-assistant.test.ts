import { describe, expect, it } from "vitest";
import { answer, detectIntent } from "./assistant";
import { analyzePricing } from "./benchmark";
import { buildLlmContext } from "./llm-context";
import type { CompetitorView } from "./competitors";
import type { CopilotSnapshot } from "./types";

const comp = (id: string, name: string, area: string | null, fees: [string, number][], extra: Partial<CompetitorView> = {}): CompetitorView => ({
  id, name, area, contact: null, offers: null, notes: null, fees: fees.map(([level, feeCents]) => ({ level, feeCents })), ...extra,
});

const competitors = [
  comp("1", "Centre Excellence", "Cocody", [["3e", 30_000]], { offers: "Pack fratrie -15 %", notes: "Très bien situé" }),
  comp("2", "Soutien Plus", "Marcory", [["3e", 20_000]]),
  comp("3", "Réussite Académie", "Cocody", [["3e", 40_000]]),
];

const snapshot = (list: CompetitorView[]): CopilotSnapshot => ({
  schoolName: "Academy", currency: "FCFA", arrears: [], upcoming: [], absences: [], teachers: [],
  levels: [{ level: "3e", students: 12, feeCents: 25_000 }],
  competitors: list,
});

describe("competitors intent", () => {
  it("recognizes the user's wording and comparison requests", () => {
    expect(detectIntent("nous devons avoir la liste de tous les concurrents")).toBe("competitors");
    expect(detectIntent("Compare nos tarifs de 3ème avec ceux du Centre Excellence à Cocody")).toBe("competitors");
    expect(detectIntent("benchmark du marché")).toBe("competitors");
    expect(detectIntent("Quoi faire aujourd'hui ?")).toBe("today");
  });

  it("tells the user to enter competitors when there are none (and never invents any)", () => {
    const reply = answer("la liste des concurrents", snapshot([]));
    expect(reply.intent).toBe("competitors");
    expect(reply.text).toContain("Aucun concurrent");
    expect(reply.items[0]?.links[0]?.href).toBe("/ai-assistant/competitors");
  });

  it("lists every competitor with fees, offers and comments", () => {
    const reply = answer("la liste des concurrents", snapshot(competitors));
    expect(reply.text).toContain("3 concurrent(s) enregistré(s)");
    expect(reply.items).toHaveLength(3);
    expect(reply.items[0]?.detail).toContain("Pack fratrie -15 %");
    expect(reply.items[0]?.detail).toContain("Très bien situé");
  });

  it("compares our level fee with the competitors' median and filters on a named centre or zone", () => {
    const reply = answer("Compare nos tarifs de 3ème avec ceux du Centre Excellence à Cocody", snapshot(competitors));
    expect(reply.text).toContain("En 3e, 3 concurrent(s)");
    expect(reply.text).toContain("médiane 30 000 FCFA");
    expect(reply.text).toContain("5 000 FCFA en dessous de la médiane");
    // "Centre Excellence" and the zone "Cocody" select the two Cocody centres
    expect(reply.items.map((i) => i.title)).toEqual(["Centre Excellence · Cocody", "Réussite Académie · Cocody"]);
  });
});

describe("pricing uses real competitor prices once there are enough", () => {
  const levels = [{ level: "3e", feeCents: 25_000, students: 10 }];

  it("prefers competitors (3+) over the indicative matrix", () => {
    const [p] = analyzePricing(levels, "FCFA", competitors)!;
    expect(p).toMatchObject({ source: "concurrents", sample: 3, position: "low" });
    expect(p!.upliftCents).toBe((30_000 - 25_000) * 10);
  });

  it("falls back to the matrix with fewer than 3, and to null for non-FCFA schools without data", () => {
    expect(analyzePricing(levels, "FCFA", competitors.slice(0, 2))![0]!.source).toBe("référentiel");
    expect(analyzePricing(levels, "EUR", competitors.slice(0, 2))).toBeNull();
    expect(analyzePricing(levels, "EUR", competitors)![0]!.source).toBe("concurrents");
  });
});

describe("LLM context", () => {
  it("includes competitors and the comparison per level, without any personal data", () => {
    const { text } = buildLlmContext(snapshot(competitors));
    expect(text).toContain("Concurrents enregistrés (3)");
    expect(text).toContain("Centre Excellence (Cocody)");
    expect(text).toContain("3e : médiane 30 000 FCFA sur 3 concurrent(s), notre tarif 25 000 FCFA");
  });

  it("says so when there are none", () => {
    expect(buildLlmContext(snapshot([])).text).toContain("Concurrents : aucun enregistré.");
  });
});
