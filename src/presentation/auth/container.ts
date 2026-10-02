import { AuditService } from "@/core/application/audit-service";
import { LoginUseCase } from "@/core/application/auth/login";
import { SessionService } from "@/core/application/auth/session-service";
import { PrismaAuditRepository } from "@/infrastructure/audit/prisma-audit-repository";
import { Argon2Hasher } from "@/infrastructure/auth/argon2-hasher";
import { MemoryRateLimiter } from "@/infrastructure/auth/memory-rate-limiter";
import { PrismaSessionRepository, PrismaUserRepository } from "@/infrastructure/auth/prisma-auth-repositories";
import { Sha256TokenCodec } from "@/infrastructure/auth/token-codec";
import { env } from "@/infrastructure/env/env";

function build() {
  const e = env();
  const windowMs = e.AUTH_LOGIN_WINDOW_SEC * 1000;
  const audit = new AuditService(new PrismaAuditRepository(), (err) => console.error("audit failure", err));
  const sessions = new SessionService(new PrismaSessionRepository(), new Sha256TokenCodec());
  const login = new LoginUseCase(
    new PrismaUserRepository(),
    new Argon2Hasher(),
    sessions,
    {
      perAccount: new MemoryRateLimiter(e.AUTH_LOGIN_MAX_ATTEMPTS, windowMs),
      perIp: new MemoryRateLimiter(e.AUTH_LOGIN_IP_MAX_ATTEMPTS, windowMs),
    },
    audit,
  );
  return { audit, sessions, login };
}

const g = globalThis as unknown as { __container?: ReturnType<typeof build> };

/** Composition root. Cached on globalThis so rate-limiter state survives HMR and module re-evaluation. */
export function container() {
  return (g.__container ??= build());
}
