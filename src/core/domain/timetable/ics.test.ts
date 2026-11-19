import { describe, expect, it } from "vitest";
import { buildIcs, weekMonday } from "./ics";

describe("weekMonday", () => {
  it("renvoie le lundi de la semaine", () => {
    expect(weekMonday(new Date(2026, 10, 19)).getDay()).toBe(1); // jeudi -> lundi
    expect(weekMonday(new Date(2026, 10, 16)).getDate()).toBe(16); // déjà lundi
  });
});

describe("buildIcs", () => {
  const ics = buildIcs({
    calendarName: "EDT 3E",
    anchorMonday: new Date(2026, 10, 16), // lundi 16 nov. 2026
    slots: [
      { id: "a", weekday: 1, startTime: "08:00", endTime: "09:30", subject: "MATH", room: "A1", teacherName: "M. Fred" },
      { id: "b", weekday: 3, startTime: "16:00", endTime: "15:00", subject: "PC" }, // fin<=début -> ignoré
    ],
  });

  it("émet un VCALENDAR avec RRULE hebdo et BYDAY", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(ics).toContain("DTSTART:20261116T080000");
    expect(ics).toContain("DTEND:20261116T093000");
    expect(ics).toContain("SUMMARY:MATH");
    expect(ics).toContain("LOCATION:A1");
  });

  it("ignore les créneaux invalides", () => {
    expect(ics).not.toContain("SUMMARY:PC");
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1);
  });
});
