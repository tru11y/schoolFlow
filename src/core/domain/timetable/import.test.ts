import { describe, expect, it } from "vitest";
import { parseTimetableCsv, parseWeekday } from "./import";

describe("parseWeekday", () => {
  it("accepts names, abbreviations and numbers", () => {
    expect(parseWeekday("Lundi")).toBe(1);
    expect(parseWeekday("mer")).toBe(3);
    expect(parseWeekday("DIMANCHE")).toBe(7);
    expect(parseWeekday("5")).toBe(5);
    expect(parseWeekday("funday")).toBeNull();
    expect(parseWeekday("8")).toBeNull();
  });
});

describe("parseTimetableCsv", () => {
  const header = "Classe;Jour;Début;Fin;Matière;Enseignant;Salle";

  it("parses valid rows and auto-detects the delimiter", () => {
    const { columns, rows, errors } = parseTimetableCsv(`${header}\n6e;Lundi;08:00;10:00;Maths;Jean Dupont;A1`);
    expect(columns).toBe(true);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toEqual({
      level: "6e", weekday: 1, startTime: "08:00", endTime: "10:00",
      subject: "Maths", teacherName: "Jean Dupont", room: "A1",
    });
  });

  it("reports columns:false when identifying headers are missing", () => {
    expect(parseTimetableCsv("a;b;c\n1;2;3").columns).toBe(false);
  });

  it("collects per-line errors without dropping valid rows", () => {
    const csv = `${header}\n6e;Funday;08:00;10:00;Maths;;\n5e;Mardi;10:00;09:00;Français;;\n4e;Mercredi;08:00;09:00;SVT;;`;
    const { rows, errors } = parseTimetableCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.level).toBe("4e");
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("supports comma delimiter and optional empty teacher/room", () => {
    const { rows } = parseTimetableCsv("Classe,Jour,Début,Fin,Matière\n3e,2,14:00,16:00,Histoire");
    expect(rows[0]).toMatchObject({ level: "3e", weekday: 2, teacherName: null, room: null });
  });
});
