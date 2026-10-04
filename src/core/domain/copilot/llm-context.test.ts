import { describe, expect, it } from "vitest";
import { buildLlmContext, restoreNames } from "./llm-context";
import type { CopilotSnapshot } from "./types";

const snapshot: CopilotSnapshot = {
  schoolName: "Centre", currency: "FCFA", upcoming: [],
  arrears: [
    { studentId: "a", studentName: "Jean Kouassi", level: "3e", owedCents: 10_000, oldestDue: new Date("2026-09-10T00:00:00Z"), parent: { name: "M. Kouassi", phone: "+225 07 48 12 36 90", email: "k@x.ci" } },
  ],
  absences: [{ studentId: "a", studentName: "Jean Kouassi", level: "3e", absences: 2, lates: 1, parent: null }],
  teachers: [{ teacherId: "t", teacherName: "Marc Dubois", expectedSessions: 10, missedRollCalls: 2, lateRollCalls: 0, missingLogbook: 1 }],
  levels: [{ level: "3e", students: 12 }],
};

describe("buildLlmContext / restoreNames", () => {
  it("never leaks student, teacher or parent identifiers to the model", () => {
    const { text } = buildLlmContext(snapshot);
    for (const secret of ["Jean", "Kouassi", "Marc", "Dubois", "+225", "k@x.ci"]) expect(text).not.toContain(secret);
    expect(text).toContain("E1");
    expect(text).toContain("P1");
  });

  it("reuses one code per person and restores names in the answer", () => {
    const { text, names } = buildLlmContext(snapshot);
    expect(text.match(/E1/g)).toHaveLength(2);
    expect(restoreNames("Relancez E1 et voyez P1 (E9).", names)).toBe("Relancez Jean Kouassi et voyez Marc Dubois (E9).");
  });
});
