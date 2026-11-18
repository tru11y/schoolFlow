import { describe, expect, it, vi } from "vitest";
import type { Principal } from "@/core/domain/auth/principal";
import type { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { financeStudentScope, studentScopeWhere } from "./student-scope";

type Db = ReturnType<typeof tenantPrisma>;

const principal = (role: Principal["role"], userId = "u1"): Principal => ({
  sessionId: "s", userId, schoolId: "school1", role,
});

const dbWithLinks = (links: { studentId: string }[]) =>
  ({ guardianLink: { findMany: vi.fn().mockResolvedValue(links) } }) as unknown as Db;

describe("financeStudentScope", () => {
  it("is unrestricted for staff roles", async () => {
    for (const role of ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const) {
      const db = dbWithLinks([]);
      expect(await financeStudentScope(db, principal(role))).toEqual({ all: true });
      expect(db.guardianLink.findMany).not.toHaveBeenCalled();
    }
  });

  it("restricts a PARENT to their own children", async () => {
    const db = dbWithLinks([{ studentId: "c1" }, { studentId: "c2" }]);
    const scope = await financeStudentScope(db, principal("PARENT", "parent1"));
    expect(scope).toEqual({ all: false, studentIds: ["c1", "c2"] });
    expect(db.guardianLink.findMany).toHaveBeenCalledWith({
      where: { parentId: "parent1" },
      select: { studentId: true },
    });
  });

  it("scopes a childless PARENT to nobody (empty, not unrestricted)", async () => {
    const scope = await financeStudentScope(dbWithLinks([]), principal("PARENT"));
    expect(scope).toEqual({ all: false, studentIds: [] });
  });
});

describe("studentScopeWhere", () => {
  it("produces no filter when unrestricted", () => {
    expect(studentScopeWhere({ all: true })).toEqual({});
  });

  it("produces an `in` filter when scoped, including the empty case", () => {
    expect(studentScopeWhere({ all: false, studentIds: ["c1", "c2"] })).toEqual({ studentId: { in: ["c1", "c2"] } });
    expect(studentScopeWhere({ all: false, studentIds: [] })).toEqual({ studentId: { in: [] } });
  });
});
