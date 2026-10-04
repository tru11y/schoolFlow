import { describe, expect, it } from "vitest";
import { buildActionCards, contactLinks, flagAbsentees, rankTeachers, splitBalances, underStaffed } from "./rules";

const now = new Date("2026-10-10T08:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe("splitBalances", () => {
  it("separates overdue from due-soon balances and ignores settled or distant invoices", () => {
    const { overdue, upcoming } = splitBalances(
      [
        { studentId: "a", amountCents: 10_000, paidCents: 2_000, dueDate: day(-5) },
        { studentId: "a", amountCents: 5_000, paidCents: 0, dueDate: day(-20) },
        { studentId: "b", amountCents: 8_000, paidCents: 0, dueDate: day(2) },
        { studentId: "c", amountCents: 8_000, paidCents: 8_000, dueDate: day(-1) },
        { studentId: "d", amountCents: 8_000, paidCents: 0, dueDate: day(10) },
      ],
      now,
    );
    expect(overdue.get("a")).toEqual({ owed: 13_000, oldest: day(-20) });
    expect(upcoming.get("b")?.owed).toBe(8_000);
    const all = [...overdue.keys(), ...upcoming.keys()];
    expect(all).not.toContain("c");
    expect(all).not.toContain("d");
  });
});

describe("flagAbsentees", () => {
  it("flags only students strictly above the threshold", () => {
    const r = (studentId: string, status: "ABSENT" | "LATE" | "PRESENT") => ({ studentId, status });
    const flagged = flagAbsentees([r("a", "ABSENT"), r("a", "LATE"), r("a", "LATE"), r("b", "ABSENT"), r("b", "ABSENT"), r("c", "PRESENT")]);
    expect([...flagged.keys()]).toEqual(["a"]);
    expect(flagged.get("a")).toEqual({ absences: 1, lates: 2 });
  });
});

describe("rankTeachers / underStaffed", () => {
  it("ranks the least punctual first and drops flawless teachers", () => {
    const t = (teacherName: string, missed: number, late: number, log: number) =>
      ({ teacherId: teacherName, teacherName, expectedSessions: 10, missedRollCalls: missed, lateRollCalls: late, missingLogbook: log });
    expect(rankTeachers([t("Ok", 0, 0, 0), t("B", 1, 0, 0), t("C", 3, 2, 1)]).map((x) => x.teacherName)).toEqual(["C", "B"]);
  });

  it("lists small classes, smallest first", () => {
    const sizes = [{ level: "3e", students: 20 }, { level: "4e", students: 5 }, { level: "5e", students: 2 }];
    expect(underStaffed(sizes).map((l) => l.level)).toEqual(["5e", "4e"]);
  });
});

describe("contactLinks / buildActionCards", () => {
  it("encodes the message and only offers channels the parent has", () => {
    const links = contactLinks({ name: "M. Kouassi", phone: "+225 07 48 12 36 90", email: null }, "Bonjour & merci", "Sujet");
    expect(links.map((l) => l.kind)).toEqual(["whatsapp", "sms"]);
    expect(links[0]!.href).toBe("https://wa.me/2250748123690?text=Bonjour%20%26%20merci");
    expect(contactLinks(null, "x", "y")).toEqual([]);
  });

  it("orders cards by priority and skips empty sections", () => {
    const cards = buildActionCards({
      schoolName: "S", currency: "FCFA", upcoming: [], teachers: [],
      arrears: [{ studentId: "a", studentName: "Jean K", level: "3e", owedCents: 10_000, oldestDue: day(-3), parent: null }],
      absences: [], levels: [{ level: "4e", students: 3 }],
    });
    expect(cards.map((c) => c.id)).toEqual(["arrears", "growth"]);
  });
});
