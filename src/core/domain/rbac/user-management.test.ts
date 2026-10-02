import { describe, expect, it } from "vitest";
import { canManageRole, splitFullName } from "./user-management";

describe("canManageRole", () => {
  it("prevents privilege escalation to SUPER_ADMIN", () => {
    expect(canManageRole("SCHOOL_ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageRole("SCHOOL_ADMIN", "TEACHER")).toBe(true);
  });
});

describe("splitFullName", () => {
  it("splits first and remaining words, rejects single words", () => {
    expect(splitFullName("  Jean-Baptiste   N'Guessan ")).toEqual({ firstName: "Jean-Baptiste", lastName: "N'Guessan" });
    expect(splitFullName("Marie de la Fontaine")).toEqual({ firstName: "Marie", lastName: "de la Fontaine" });
    expect(splitFullName("Madonna")).toBeNull();
  });
});
