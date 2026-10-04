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

  it("restricts chat peers", () => {
    expect(canChat("STUDENT", "PARENT")).toBe(false);
    expect(canChat("STUDENT", "TEACHER")).toBe(true);
  });
});
