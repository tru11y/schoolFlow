import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuditEntryInput } from "../domain/audit/audit-entry";
import type { Principal } from "../domain/auth/principal";
import { ForbiddenError } from "../domain/errors";
import { createSecureAction } from "./secure-action";

const teacher: Principal = { sessionId: "s", userId: "u1", schoolId: "A", role: "TEACHER" };

function setup(principal: Principal | null = teacher) {
  const audit: AuditEntryInput[] = [];
  const pending: Promise<void>[] = [];
  const onError = vi.fn();
  const secureAction = createSecureAction({
    getPrincipal: async () => principal,
    createDb: (p) => ({ scopedTo: p.schoolId }),
    audit: { record: async (e) => void audit.push(e) },
    getRequestContext: async () => ({ ip: "1.1.1.1", userAgent: "ua" }),
    defer: (task) => void pending.push(task()),
    onError,
  });
  return { secureAction, audit, onError, flush: () => Promise.all(pending) };
}

const input = z.object({ title: z.string().min(1), password: z.string().optional() });
const base = { name: "homework.create", resource: "homework", input };

describe("secureAction", () => {
  it("rejects unauthenticated callers without running the handler", async () => {
    const { secureAction, audit, flush } = setup(null);
    const handler = vi.fn();
    const res = await secureAction({ ...base }, handler)({ title: "x" });
    await flush();
    expect(res).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(handler).not.toHaveBeenCalled();
    expect(audit[0]).toMatchObject({ outcome: "DENIED", actorId: null });
  });

  it("denies and audits a missing permission", async () => {
    const { secureAction, audit, flush } = setup();
    const handler = vi.fn();
    const res = await secureAction({ ...base, permission: "finance:write" }, handler)({ title: "x" });
    await flush();
    expect(res).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(handler).not.toHaveBeenCalled();
    expect(audit[0]).toMatchObject({ outcome: "DENIED", actorId: "u1", metadata: { reason: "finance:write" } });
  });

  it("denies non-super users without a tenant", async () => {
    const { secureAction } = setup({ ...teacher, schoolId: null });
    const res = await secureAction({ ...base }, vi.fn())({ title: "x" });
    expect(res).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("returns field errors and audits field names only", async () => {
    const { secureAction, audit, flush } = setup();
    const handler = vi.fn();
    const res = await secureAction({ ...base }, handler)({ title: "", password: "hunter2" });
    await flush();
    expect(res).toMatchObject({ ok: false, error: { code: "VALIDATION", fieldErrors: { title: expect.any(Array) } } });
    expect(handler).not.toHaveBeenCalled();
    expect(audit[0]).toMatchObject({ outcome: "FAILURE", metadata: { fields: ["title"] } });
    expect(JSON.stringify(audit)).not.toContain("hunter2");
  });

  it("runs the handler with parsed input, tenant-scoped db and audits success", async () => {
    const { secureAction, audit, flush } = setup();
    const handler = vi.fn(async (ctx) => ({ id: "h1", db: ctx.db }));
    const res = await secureAction(
      { ...base, permission: "homework:write", resourceId: (_i, d) => d.id },
      handler,
    )({ title: "Maths", extra: "stripped" });
    await flush();
    expect(res).toEqual({ ok: true, data: { id: "h1", db: { scopedTo: "A" } } });
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ schoolId: "A", input: { title: "Maths" } });
    expect(handler.mock.calls[0]?.[0].input).not.toHaveProperty("extra");
    expect(audit[0]).toMatchObject({
      action: "homework.create", resource: "homework", resourceId: "h1",
      outcome: "SUCCESS", schoolId: "A", actorRole: "TEACHER", ip: "1.1.1.1",
    });
  });

  it("audits only the fields chosen by auditMetadata and derives resourceId from the result", async () => {
    const { secureAction, audit, flush } = setup();
    await secureAction(
      { ...base, auditMetadata: (i) => ({ titleLength: i.title.length }), resourceId: (_i, d) => d.id },
      async () => ({ id: "new-1" }),
    )({ title: "Secret address", password: "x" });
    await flush();
    expect(audit[0]).toMatchObject({ resourceId: "new-1", metadata: { input: { titleLength: 14 } } });
    expect(JSON.stringify(audit)).not.toContain("Secret address");
  });

  it("adds the severity and lets auditMetadata see the handler result", async () => {
    const { secureAction, audit, flush } = setup();
    await secureAction(
      { ...base, auditSeverity: (_i, d) => (d.late ? "WARNING" : "INFO"), auditMetadata: (_i, d) => ({ late: d?.late }) },
      async () => ({ late: true }),
    )({ title: "x" });
    await flush();
    expect(audit[0]).toMatchObject({ metadata: { severity: "WARNING", input: { late: true } } });
  });

  it("gives SUPER_ADMIN a null tenant", async () => {
    const { secureAction } = setup({ ...teacher, role: "SUPER_ADMIN", schoolId: null });
    const handler = vi.fn(async (_ctx: { schoolId: string | null }) => 1);
    await secureAction({ ...base }, handler)({ title: "x" });
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ schoolId: null });
  });

  it("maps a ForbiddenError thrown by the handler to FORBIDDEN/DENIED", async () => {
    const { secureAction, audit, flush } = setup();
    const res = await secureAction({ ...base }, async () => {
      throw new ForbiddenError("tenant:mismatch");
    })({ title: "x" });
    await flush();
    expect(res).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(audit[0]).toMatchObject({ outcome: "DENIED" });
  });

  it("hides internal errors from the client but logs and audits them", async () => {
    const { secureAction, audit, onError, flush } = setup();
    const res = await secureAction({ ...base }, async () => {
      throw new Error("db password=secret leaked");
    })({ title: "x" });
    await flush();
    expect(res).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(res)).not.toContain("secret");
    expect(onError).toHaveBeenCalledOnce();
    expect(audit[0]).toMatchObject({ outcome: "FAILURE", metadata: { error: "Error" } });
    expect(JSON.stringify(audit)).not.toContain("secret");
  });

  it("rethrows Next control-flow errors (redirect) and audits success", async () => {
    const { secureAction, audit, flush } = setup();
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    await expect(
      secureAction({ ...base }, async () => {
        throw redirect;
      })({ title: "x" }),
    ).rejects.toBe(redirect);
    await flush();
    expect(audit[0]).toMatchObject({ outcome: "SUCCESS" });
  });
});
