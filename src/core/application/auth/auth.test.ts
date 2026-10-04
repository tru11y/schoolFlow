import { describe, expect, it, vi } from "vitest";
import { MemoryRateLimiter } from "@/infrastructure/auth/memory-rate-limiter";
import { Sha256TokenCodec } from "@/infrastructure/auth/token-codec";
import type { AuditEntryInput } from "../../domain/audit/audit-entry";
import { ForbiddenError, InvalidCredentialsError, RateLimitedError } from "../../domain/errors";
import type { AuthUser, PasswordHasher, SessionRepository, SessionView } from "../ports/auth-ports";
import { assertPermission } from "./authorize";
import { LoginUseCase } from "./login";
import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_MS, SessionService } from "./session-service";

const user: AuthUser = { id: "u1", schoolId: "s1", role: "TEACHER", passwordHash: "h:good" };

function fakeHasher(): PasswordHasher & { dummy: ReturnType<typeof vi.fn> } {
  const dummy = vi.fn(async () => {});
  return {
    hash: async (p) => `h:${p}`,
    verify: async (h, p) => h === `h:${p}`,
    needsRehash: () => false,
    verifyDummy: dummy,
    dummy,
  };
}

function fakeSessionRepo(): SessionRepository & { rows: Map<string, SessionView>; touched: number } {
  const rows = new Map<string, SessionView>();
  const repo = {
    rows,
    touched: 0,
    async create(i: Parameters<SessionRepository["create"]>[0]) {
      rows.set(i.tokenHash, {
        id: `sess-${rows.size}`, userId: i.userId, schoolId: "s1", role: "TEACHER",
        createdAt: new Date(), lastSeenAt: new Date(), expiresAt: i.expiresAt, revokedAt: null,
      });
    },
    async findByTokenHash(h: string) { return rows.get(h) ?? null; },
    async touch() { repo.touched++; },
    async revokeByTokenHash(h: string, at: Date) {
      const r = rows.get(h);
      if (r) r.revokedAt = at;
    },
    async revokeOldestActive(userId: string, keep: number, now: Date) {
      const active = [...rows.values()].filter((r) => r.userId === userId && !r.revokedAt && r.expiresAt > now).reverse();
      active.slice(keep).forEach((r) => { r.revokedAt = now; });
      return Math.min(active.length, keep);
    },
    async revokeAllForUser(userId: string, at: Date) {
      rows.forEach((r) => { if (r.userId === userId && !r.revokedAt) r.revokedAt = at; });
    },
  };
  return repo;
}

function setup(max = 3) {
  const audit: AuditEntryInput[] = [];
  const hasher = fakeHasher();
  const repo = fakeSessionRepo();
  const sessions = new SessionService(repo, new Sha256TokenCodec());
  const login = new LoginUseCase(
    { findActiveByEmail: async (e) => (e === "t@x.fr" ? user : null), updatePasswordHash: async () => {} },
    hasher,
    sessions,
    { perAccount: new MemoryRateLimiter(max, 60_000), perIp: new MemoryRateLimiter(100, 60_000) },
    { record: async (e) => void audit.push(e) },
  );
  return { audit, hasher, repo, sessions, login };
}

const ctx = { ip: "1.1.1.1", userAgent: "ua" };

describe("LoginUseCase", () => {
  it("creates a session and audits success", async () => {
    const { login, audit, sessions } = setup();
    const { token } = await login.execute({ email: " T@x.fr ", password: "good", ...ctx });
    expect(await sessions.validate(token)).toMatchObject({ userId: "u1", role: "TEACHER" });
    expect(audit.at(-1)).toMatchObject({ action: "auth.login", outcome: "SUCCESS", actorId: "u1" });
  });

  it("rejects a wrong password with a generic error and audits it", async () => {
    const { login, audit } = setup();
    await expect(login.execute({ email: "t@x.fr", password: "bad", ...ctx })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(audit.at(-1)).toMatchObject({ outcome: "DENIED" });
    expect(JSON.stringify(audit)).not.toContain("bad");
  });

  it("burns hash time for unknown accounts", async () => {
    const { login, hasher } = setup();
    await expect(login.execute({ email: "nobody@x.fr", password: "x", ...ctx })).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.dummy).toHaveBeenCalledOnce();
  });

  it("blocks after too many attempts, even with the right password", async () => {
    const { login, audit } = setup(3);
    for (let i = 0; i < 3; i++) {
      await expect(login.execute({ email: "t@x.fr", password: "bad", ...ctx })).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(login.execute({ email: "t@x.fr", password: "good", ...ctx })).rejects.toBeInstanceOf(RateLimitedError);
    expect(audit.at(-1)?.action).toBe("auth.login.rate_limited");
  });
});

describe("SessionService", () => {
  const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

  async function sessionAt(clock: { t: number }) {
    const repo = fakeSessionRepo();
    const svc = new SessionService(repo, new Sha256TokenCodec(), () => at(clock.t));
    const { token } = await svc.create("u1", ctx);
    const row = [...repo.rows.values()][0]!;
    row.createdAt = at(0);
    row.lastSeenAt = at(0);
    return { svc, repo, token, row };
  }

  it("rejects unknown, revoked and idle-expired sessions", async () => {
    const clock = { t: 0 };
    const { svc, token } = await sessionAt(clock);
    expect(await svc.validate("nope")).toBeNull();
    clock.t = SESSION_IDLE_TTL_MS + 1;
    expect(await svc.validate(token)).toBeNull();
  });

  it("rejects revoked sessions", async () => {
    const { svc, token } = await sessionAt({ t: 0 });
    await svc.revoke(token);
    expect(await svc.validate(token)).toBeNull();
  });

  it("slides the idle window but never past the absolute limit", async () => {
    const clock = { t: 0 };
    const { svc, repo, token, row } = await sessionAt(clock);
    clock.t = 10 * 60_000;
    expect(await svc.validate(token)).not.toBeNull();
    expect(repo.touched).toBe(1);

    clock.t = SESSION_ABSOLUTE_TTL_MS + 1;
    row.expiresAt = at(clock.t + 1000);
    expect(await svc.validate(token)).toBeNull();
  });
});

describe("assertPermission", () => {
  const p = { sessionId: "s", userId: "u", schoolId: "s1", role: "STUDENT" as const };
  it("allows and denies by role", () => {
    expect(() => assertPermission(p, "homework:read")).not.toThrow();
    expect(() => assertPermission(p, "finance:write")).toThrow(ForbiddenError);
  });
});

describe("multi-device sessions", () => {
  it("keeps earlier sessions valid on a new login and audits the multi-device login", async () => {
    const { login, sessions, audit } = setup();
    const phone = await login.execute({ email: "t@x.fr", password: "good", ...ctx, userAgent: "phone" });
    const laptop = await login.execute({ email: "t@x.fr", password: "good", ...ctx, userAgent: "laptop" });
    expect(await sessions.validate(phone.token)).not.toBeNull();
    expect(await sessions.validate(laptop.token)).not.toBeNull();
    expect(audit.at(-1)).toMatchObject({ action: "USER_LOGIN_MULTI_DEVICE", metadata: { device: "laptop", otherActiveSessions: 1 } });
  });

  it("revokes only the oldest session beyond the cap of 5", async () => {
    const { sessions } = setup();
    const tokens: string[] = [];
    for (let i = 0; i < 6; i++) tokens.push((await sessions.create("u1", ctx)).token);
    expect(await sessions.validate(tokens[0]!)).toBeNull();
    for (const t of tokens.slice(1)) expect(await sessions.validate(t)).not.toBeNull();
  });

  it("logout revokes one device; revokeAll revokes every device", async () => {
    const { sessions } = setup();
    const a = (await sessions.create("u1", ctx)).token;
    const b = (await sessions.create("u1", ctx)).token;
    await sessions.revoke(a);
    expect(await sessions.validate(a)).toBeNull();
    expect(await sessions.validate(b)).not.toBeNull();
    await sessions.revokeAll("u1");
    expect(await sessions.validate(b)).toBeNull();
  });
});
