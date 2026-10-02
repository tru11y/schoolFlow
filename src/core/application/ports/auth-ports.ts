import type { Role } from "../../domain/rbac/role";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
  /** Spends the same time as a real verify, to hide whether an account exists. */
  verifyDummy(password: string): Promise<void>;
}

export interface AuthUser {
  id: string;
  schoolId: string | null;
  role: Role;
  passwordHash: string;
}

export interface UserRepository {
  findActiveByEmail(email: string): Promise<AuthUser | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface SessionView {
  id: string;
  userId: string;
  schoolId: string | null;
  role: Role;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface SessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void>;
  /** Must exclude sessions of soft-deleted users. */
  findByTokenHash(tokenHash: string): Promise<SessionView | null>;
  touch(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void>;
  revokeByTokenHash(tokenHash: string, at: Date): Promise<void>;
}

export interface TokenCodec {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

export interface RateLimiter {
  /** Counts one attempt for `key`. */
  consume(key: string): Promise<{ allowed: boolean; retryAfterSec: number }>;
  reset(key: string): Promise<void>;
}
