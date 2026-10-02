import type { Role } from "@/core/domain/rbac/role";
import type {
  AuthUser, SessionRepository, SessionView, UserRepository,
} from "@/core/application/ports/auth-ports";
import { prisma } from "../db/prisma";

export class PrismaUserRepository implements UserRepository {
  async findActiveByEmail(email: string): Promise<AuthUser | null> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, isActive: true },
      select: { id: true, schoolId: true, role: true, passwordHash: true },
    });
    return user ? { ...user, role: user.role as Role } : null;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }
}

export class PrismaSessionRepository implements SessionRepository {
  async create(input: Parameters<SessionRepository["create"]>[0]): Promise<void> {
    await prisma.session.create({ data: input });
  }

  async findByTokenHash(tokenHash: string): Promise<SessionView | null> {
    const s = await prisma.session.findFirst({
      where: { tokenHash, user: { deletedAt: null, isActive: true } },
      select: {
        id: true, userId: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true,
        user: { select: { schoolId: true, role: true } },
      },
    });
    if (!s) return null;
    const { user, ...session } = s;
    return { ...session, schoolId: user.schoolId, role: user.role as Role };
  }

  async touch(sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
    await prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { lastSeenAt, expiresAt } });
  }

  async revokeByTokenHash(tokenHash: string, at: Date): Promise<void> {
    await prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: at } });
  }
}
