import type { Principal } from "../../domain/auth/principal";
import type { SessionRepository, TokenCodec } from "../ports/auth-ports";

export const SESSION_IDLE_TTL_MS = 8 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export class SessionService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenCodec,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(userId: string, ctx: RequestContext): Promise<{ token: string; expiresAt: Date }> {
    const { token, hash } = this.tokens.generate();
    const expiresAt = new Date(this.now().getTime() + SESSION_IDLE_TTL_MS);
    await this.sessions.create({ userId, tokenHash: hash, expiresAt, ...ctx });
    return { token, expiresAt };
  }

  async validate(token: string): Promise<Principal | null> {
    const session = await this.sessions.findByTokenHash(this.tokens.hash(token));
    if (!session || session.revokedAt) return null;

    const now = this.now();
    const absoluteEnd = session.createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS;
    if (session.expiresAt <= now || absoluteEnd <= now.getTime()) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      const expiresAt = new Date(Math.min(now.getTime() + SESSION_IDLE_TTL_MS, absoluteEnd));
      await this.sessions.touch(session.id, now, expiresAt);
    }

    return { sessionId: session.id, userId: session.userId, schoolId: session.schoolId, role: session.role };
  }

  async revoke(token: string): Promise<void> {
    await this.sessions.revokeByTokenHash(this.tokens.hash(token), this.now());
  }
}
