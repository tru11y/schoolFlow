import { describe, expect, it } from "vitest";
import { can, canChat } from "./role";

describe("rbac", () => {
  it("denies by default", () => {
    expect(can("STUDENT", "finance:write")).toBe(false);
    expect(can("TEACHER", "audit:read")).toBe(false);
  });

  it("reserves the AI copilot to SUPER_ADMIN", () => {
    expect(can("SUPER_ADMIN", "copilot:use")).toBe(true);
    for (const role of ["SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"] as const) {
      expect(can(role, "copilot:use")).toBe(false);
    }
  });

  it("reserves invoice management to SUPER_ADMIN", () => {
    expect(can("SUPER_ADMIN", "invoice:manage")).toBe(true);
    for (const role of ["SCHOOL_ADMIN", "ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"] as const) {
      expect(can(role, "invoice:manage")).toBe(false);
    }
  });

  it("reserves payment edit/delete to SUPER_ADMIN and SCHOOL_ADMIN", () => {
    expect(can("SUPER_ADMIN", "payment:manage")).toBe(true);
    expect(can("SCHOOL_ADMIN", "payment:manage")).toBe(true);
    for (const role of ["ACCOUNTANT", "TEACHER", "STUDENT", "PARENT"] as const) {
      expect(can(role, "payment:manage")).toBe(false);
    }
  });

  it("lets the directeur and accountant record payments", () => {
    for (const role of ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const) {
      expect(can(role, "finance:write")).toBe(true);
      expect(can(role, "receipt:issue")).toBe(true);
    }
  });

  it("restricts chat peers", () => {
    expect(canChat("STUDENT", "PARENT")).toBe(false);
    expect(canChat("STUDENT", "TEACHER")).toBe(true);
  });
});
