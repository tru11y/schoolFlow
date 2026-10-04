import { describe, expect, it } from "vitest";
import {
  analyzeClassSizes, analyzeCourses, analyzePricing, buildInsights, groupSiblings, normalizeLevel, type GrowthSnapshot,
} from "./benchmark";
import { topRoiActions } from "./roi";
import { collectionMessage, toneFor } from "./messages";
import type { CopilotSnapshot, StudentArrear } from "./types";

describe("normalizeLevel", () => {
  it("maps school-specific names to benchmark keys", () => {
    expect(normalizeLevel("3ème")).toBe("3e");
    expect(normalizeLevel("3e")).toBe("3e");
    expect(normalizeLevel("Terminale C")).toBe("Tle");
    expect(normalizeLevel("Seconde")).toBe("2nde");
    expect(normalizeLevel("Première S")).toBe("1ère");
    expect(normalizeLevel("Soutien Supérieur")).toBeNull();
  });
});

describe("analyzePricing", () => {
  it("only applies to FCFA schools", () => {
    expect(analyzePricing([{ level: "3e", feeCents: 10_000, students: 5 }], "EUR")).toBeNull();
  });

  it("flags fees under the market and estimates the uplift to the median", () => {
    const [p] = analyzePricing([{ level: "3e", feeCents: 18_000, students: 10 }], "FCFA")!;
    expect(p).toMatchObject({ position: "below_market", upliftCents: (27_500 - 18_000) * 10 });
  });

  it("recognizes aligned, premium and missing fees", () => {
    const res = analyzePricing(
      [
        { level: "3e", feeCents: 28_000, students: 5 },
        { level: "4e", feeCents: 60_000, students: 5 },
        { level: "5e", feeCents: null, students: 5 },
        { level: "Soutien", feeCents: 1, students: 1 },
      ],
      "FCFA",
    )!;
    expect(res.map((r) => r.position)).toEqual(["aligned", "above_market", "no_fee", "unknown_level"]);
    expect(res[0]!.upliftCents).toBe(0);
  });
});

describe("class sizes and courses", () => {
  it("sizes against the 15-20 optimum, with the revenue the gap would bring", () => {
    const res = analyzeClassSizes(
      [
        { level: "3e", feeCents: 25_000, students: 12 },
        { level: "4e", feeCents: 20_000, students: 17 },
        { level: "Tle", feeCents: 30_000, students: 24 },
        { level: "6e", feeCents: null, students: 0 },
      ],
      "FCFA",
    );
    expect(res.map((r) => r.status)).toEqual(["under", "optimal", "over", "empty"]);
    expect(res[0]).toMatchObject({ gap: 3, potentialCents: 75_000 });
    expect(res[2]!.gap).toBe(4);
  });

  it("lists under-filled sessions, emptiest first", () => {
    const res = analyzeCourses([
      { name: "Maths 3e", weekday: 1, startTime: "17:30", enrolled: 14 },
      { name: "Anglais", weekday: 5, startTime: "17:00", enrolled: 3 },
      { name: "Plein", weekday: 2, startTime: "17:30", enrolled: 18 },
    ]);
    expect(res.map((c) => c.name)).toEqual(["Anglais", "Maths 3e"]);
    expect(res[0]).toMatchObject({ slot: "Vendredi 17h00", missing: 12 });
  });
});

describe("groupSiblings", () => {
  it("groups students that share a phone number or an e-mail", () => {
    const res = groupSiblings([
      { studentId: "a", phone: "+225 07 48 12 36 90", email: null },
      { studentId: "b", phone: "0748123690", email: null },
      { studentId: "c", phone: null, email: "Parent@x.fr" },
      { studentId: "d", phone: null, email: "parent@x.fr" },
      { studentId: "e", phone: "+225 01 00 00 00 00", email: null },
    ]);
    expect(res).toEqual({ families: 1, students: 2 });
  });
});

const growth: GrowthSnapshot = {
  currency: "FCFA",
  levels: [
    { level: "3e", feeCents: 20_000, students: 12 },
    { level: "Tle", feeCents: 40_000, students: 16 },
  ],
  courses: [{ name: "Anglais", weekday: 5, startTime: "17:00", enrolled: 2 }],
  siblingFamilies: 2,
  siblingStudents: 4,
};

describe("buildInsights + topRoiActions", () => {
  const arrear = (id: string, level: string, owed: number): StudentArrear => ({
    studentId: id, studentName: `Eleve ${id}`, level, owedCents: owed, oldestDue: new Date("2026-09-10"), parent: null,
  });
  const snapshot: CopilotSnapshot = {
    schoolName: "Academy", currency: "FCFA",
    arrears: [arrear("1", "3e", 20_000), arrear("2", "3e", 25_000), arrear("3", "4e", 5_000)],
    upcoming: [], absences: [], teachers: [], levels: [],
  };

  it("builds pricing, capacity, course and pack insights, biggest impact first", () => {
    const insights = buildInsights(growth);
    expect(insights.map((i) => i.kind)).toContain("pack");
    expect(insights.find((i) => i.id === "pack-fratrie")).toBeDefined();
    expect(insights.find((i) => i.id === "exam-Tle")?.impactCents).toBe(Math.round(Math.round(40_000 * 0.3) * 16 / 2));
    const impacts = insights.map((i) => i.impactCents);
    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
  });

  it("returns the 3 actions with the highest confidence-weighted amount, sorted", () => {
    const top = topRoiActions(snapshot, buildInsights(growth), 3);
    expect(top).toHaveLength(3);
    const scores = top.map((a) => a.impactCents * a.confidence);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    // 96 000 x 0.8 (exam option) > 90 000 x 0.6 (pricing) > 45 000 x 1 (real receivable)
    expect(top.map((a) => a.id)).toEqual(["exam-Tle", "price-3e", "recover-3e"]);
  });

  it("does not let a recruitment hypothesis outrank an equal real receivable", () => {
    const only = topRoiActions(
      { ...snapshot, arrears: [arrear("1", "3e", 100_000)] },
      [{ id: "size-3e", kind: "capacity", title: "Remplir", detail: "", impactCents: 150_000 }],
      2,
    );
    expect(only.map((a) => a.id)).toEqual(["recover-3e", "size-3e"]);
  });

  it("phrases recovery actions per class with the amount to recover", () => {
    const all = topRoiActions(snapshot, buildInsights(growth), 10);
    expect(all.find((a) => a.id === "recover-3e")).toMatchObject({ title: "Relancer 2 parents en 3e", impactCents: 45_000 });
    expect(all.find((a) => a.id === "recover-4e")).toMatchObject({ title: "Relancer 1 parent en 4e", impactCents: 5_000 });
  });

  it("never proposes an action without an amount at stake", () => {
    expect(topRoiActions({ ...snapshot, arrears: [] }, [], 3)).toEqual([]);
  });
});

describe("collectionMessage", () => {
  const a: StudentArrear = {
    studentId: "1", studentName: "Kouamé Yao", level: "3e", owedCents: 25_000,
    oldestDue: new Date("2026-10-01T00:00:00Z"), parent: { name: "M. Yao", phone: null, email: null },
  };

  it("is courteous and short, naming the amount, child and class", () => {
    const text = collectionMessage(a, "SchoolFlow Academy", "FCFA", new Date("2026-10-05T00:00:00Z"));
    expect(text).toContain("M. Yao");
    expect(text).toContain("25 000 FCFA");
    expect(text).toContain("Kouamé");
    expect(text).toContain("Mobile Money");
    expect(text.split("\n").length).toBeLessThanOrEqual(4);
  });

  it("gets firmer after two weeks", () => {
    expect(toneFor(a, new Date("2026-10-05T00:00:00Z"))).toBe("soft");
    expect(toneFor(a, new Date("2026-10-20T00:00:00Z"))).toBe("firm");
    expect(collectionMessage(a, "X", "FCFA", new Date("2026-10-20T00:00:00Z"))).toContain("en retard depuis le");
  });
});
