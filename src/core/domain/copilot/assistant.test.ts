import { describe, expect, it } from "vitest";
import { answer, detectIntent, levelKey } from "./assistant";
import type { CopilotSnapshot } from "./types";

const snapshot: CopilotSnapshot = {
  schoolName: "Centre", currency: "FCFA", upcoming: [], absences: [],
  levels: [{ level: "4e", students: 3 }],
  teachers: [
    { teacherId: "t1", teacherName: "Marc", expectedSessions: 10, missedRollCalls: 4, lateRollCalls: 1, missingLogbook: 2 },
    { teacherId: "t2", teacherName: "Camille", expectedSessions: 10, missedRollCalls: 0, lateRollCalls: 0, missingLogbook: 0 },
  ],
  arrears: [
    { studentId: "a", studentName: "Jean Kouassi", level: "3e", owedCents: 10_000, oldestDue: new Date("2026-09-10T00:00:00Z"), parent: { name: "M. Kouassi", phone: "+225 07 48 12 36 90", email: null } },
    { studentId: "b", studentName: "Awa Traoré", level: "4e", owedCents: 5_000, oldestDue: new Date("2026-09-10T00:00:00Z"), parent: null },
  ],
};

describe("detectIntent", () => {
  it("routes the documented example questions", () => {
    expect(detectIntent("Qui sont les 3 profs les moins assidus ce mois-ci ?")).toBe("teachers");
    expect(detectIntent("Génère un message de relance pour les arriérés de la 3ème")).toBe("arrears");
    expect(detectIntent("Comment augmenter notre effectif en 4ème ?")).toBe("growth");
    expect(detectIntent("quels élèves sont absents")).toBe("absences");
    expect(detectIntent("bonjour")).toBe("help");
  });

  it("extracts the class from French ordinals", () => {
    expect(levelKey("arriérés de la 3ème")).toBe("3");
    expect(levelKey("la 4e")).toBe("4");
    expect(levelKey("tout le monde")).toBeNull();
  });
});

describe("answer", () => {
  it("filters arrears by class and builds a WhatsApp link with the amount", () => {
    const r = answer("relance arriérés de la 3ème", snapshot);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.title).toContain("Jean Kouassi");
    expect(decodeURIComponent(r.items[0]!.links[0]!.href)).toContain("10");
    expect(r.items[0]!.links[0]!.kind).toBe("whatsapp");
  });

  it("ranks only teachers with faults", () => {
    const r = answer("profs les moins assidus", snapshot);
    expect(r.items.map((i) => i.title)).toEqual(["1. Marc"]);
  });
});
