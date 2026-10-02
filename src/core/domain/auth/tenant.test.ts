import { describe, expect, it } from "vitest";
import { ForbiddenError } from "../errors";
import type { Principal } from "./principal";
import { applyTenantScope, assertSameTenant, tenantId } from "./tenant";

const teacher: Principal = { sessionId: "s", userId: "u", schoolId: "A", role: "TEACHER" };

describe("tenant isolation", () => {
  it("SUPER_ADMIN is unscoped; others need a schoolId", () => {
    expect(tenantId({ ...teacher, role: "SUPER_ADMIN", schoolId: null })).toBeNull();
    expect(() => tenantId({ ...teacher, schoolId: null })).toThrow(ForbiddenError);
  });

  it("rejects cross-tenant access", () => {
    expect(() => assertSameTenant(teacher, "A")).not.toThrow();
    expect(() => assertSameTenant(teacher, "B")).toThrow(ForbiddenError);
  });

  it("injects schoolId into reads without dropping the caller's filter", () => {
    expect(applyTenantScope("findMany", { where: { role: "STUDENT" } }, "A")).toEqual({
      where: { role: "STUDENT", schoolId: "A" },
    });
    expect(applyTenantScope("findMany", undefined, "A")).toEqual({ where: { schoolId: "A" } });
  });

  it("keeps unique selectors valid and overrides a spoofed schoolId", () => {
    expect(applyTenantScope("update", { where: { id: "x", schoolId: "B" }, data: {} }, "A")).toEqual({
      where: { id: "x", schoolId: "A" },
      data: {},
    });
  });

  it("forces schoolId on writes, overriding a spoofed value", () => {
    expect(applyTenantScope("create", { data: { email: "x", schoolId: "B" } }, "A")).toEqual({
      data: { email: "x", schoolId: "A" },
    });
    expect(applyTenantScope("createMany", { data: [{ schoolId: "B" }] }, "A")).toEqual({ data: [{ schoolId: "A" }] });
  });

  it("denies unknown operations", () => {
    expect(() => applyTenantScope("$queryRaw", {}, "A")).toThrow(ForbiddenError);
  });
});
