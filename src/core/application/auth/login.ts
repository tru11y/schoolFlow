import { InvalidCredentialsError, RateLimitedError } from "../../domain/errors";
import type { AuditLogger } from "../audit-service";
import type { PasswordHasher, RateLimiter, UserRepository } from "../ports/auth-ports";
import type { RequestContext, SessionService } from "./session-service";

export interface LoginInput extends RequestContext {
  email: string;
  password: string;
}

export interface LoginLimiters {
  perAccount: RateLimiter;
  perIp: RateLimiter;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly limiters: LoginLimiters,
    private readonly audit: AuditLogger,
  ) {}

  async execute(input: LoginInput): Promise<{ token: string; expiresAt: Date }> {
    const email = input.email.trim().toLowerCase();
    const ipKey = input.ip ?? "unknown";
    const base = { resource: "session", resourceId: null, ip: input.ip, userAgent: input.userAgent };

    const [account, ip] = await Promise.all([
      this.limiters.perAccount.consume(`${ipKey}|${email}`),
      this.limiters.perIp.consume(ipKey),
    ]);
    if (!account.allowed || !ip.allowed) {
      await this.audit.record({
        ...base, schoolId: null, actorId: null, actorRole: null,
        action: "auth.login.rate_limited", outcome: "DENIED", metadata: { email },
      });
      throw new RateLimitedError(Math.max(account.retryAfterSec, ip.retryAfterSec));
    }

    const user = await this.users.findActiveByEmail(email);
    const valid = user
      ? await this.hasher.verify(user.passwordHash, input.password)
      : (await this.hasher.verifyDummy(input.password), false);

    if (!user || !valid) {
      await this.audit.record({
        ...base, schoolId: user?.schoolId ?? null, actorId: user?.id ?? null, actorRole: user?.role ?? null,
        action: "auth.login", outcome: "DENIED", metadata: { email },
      });
      throw new InvalidCredentialsError();
    }

    await this.limiters.perAccount.reset(`${ipKey}|${email}`);
    if (this.hasher.needsRehash(user.passwordHash)) {
      await this.users.updatePasswordHash(user.id, await this.hasher.hash(input.password));
    }

    const session = await this.sessions.create(user.id, { ip: input.ip, userAgent: input.userAgent });
    await this.audit.record({
      ...base, schoolId: user.schoolId, actorId: user.id, actorRole: user.role,
      action: "auth.login", outcome: "SUCCESS", metadata: {},
    });
    return session;
  }
}
