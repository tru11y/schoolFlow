import { describe, expect, it } from "vitest";
import { parseTimetableGrid } from "./xlsx-grid";

// Grille minimale calquée sur le classeur réel (colonnes B..I côté gauche).
// Indices 0-based : col 1 = "B" (HORAIRES), 2..8 = jours LUNDI..DIMANCHE.
function gridFromRows(rows: Record<number, string>[]): (string | null)[][] {
  const width = 9;
  return rows.map((r) => Array.from({ length: width }, (_, c) => r[c] ?? null));
}

describe("parseTimetableGrid", () => {
  const grid = gridFromRows([
    { 1: "EMPLOI DU TEMPS 6E / 5E" }, // titre
    {}, {},
    { 1: "HORAIRES", 2: "LUNDI", 3: "MARDI", 4: "MERCREDI", 5: "JEUDI", 6: "VENDREDI", 7: "SAMEDI", 8: "DIMANCHE" },
    { 1: "16H00-17H00", 4: "MATH" },
    { 1: "PAUSE" },
    { 1: "18H00-19H00", 2: "MATH", 3: "PC", 4: "ANGLAIS", 7: "FRANCAIS" },
    { 1: "19H00-20H30", 2: "MATH" },
  ]);

  const { columns, rows } = parseTimetableGrid(grid);

  it("reconnaît la grille", () => {
    expect(columns).toBe(true);
  });

  it("étend un bloc « 6E / 5E » aux deux niveaux", () => {
    const levels = new Set(rows.map((r) => r.level));
    expect(levels).toEqual(new Set(["6E", "5E"]));
  });

  it("convertit les plages horaires et saute les PAUSE", () => {
    const sixe = rows.filter((r) => r.level === "6E");
    expect(sixe).toContainEqual({ level: "6E", weekday: 3, startTime: "16:00", endTime: "17:00", subject: "MATH", teacherName: null, room: null });
    expect(sixe).toContainEqual({ level: "6E", weekday: 1, startTime: "18:00", endTime: "19:00", subject: "MATH", teacherName: null, room: null });
    // Samedi (weekday 6) FRANCAIS -> normalisé avec cédille.
    expect(sixe).toContainEqual({ level: "6E", weekday: 6, startTime: "18:00", endTime: "19:00", subject: "FRANÇAIS", teacherName: null, room: null });
  });

  it("ignore les feuilles sans bloc", () => {
    expect(parseTimetableGrid([["foo", "bar"], ["baz", null]]).columns).toBe(false);
  });
});
