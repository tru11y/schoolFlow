import type { Prisma } from "@prisma/client";
import type { AuditEntry, AuditEntryInput } from "@/core/domain/audit/audit-entry";
import { sanitize } from "@/core/domain/audit/sanitizer";
import type { Role } from "@/core/domain/rbac/role";
import type { AuditRepository } from "@/core/application/ports/audit-repository";
import { prisma } from "../db/prisma";
import { env } from "../env/env";
import { GENESIS_HASH, computeHash } from "./hash-chain";

const CHAIN_LOCK_ID = 727_001;

type HashedFields = Omit<Prisma.AuditLogUncheckedCreateInput, "seq" | "prevHash" | "hash" | "createdAt"> & {
  createdAt: Date;
};

function hashPayload(row: Omit<HashedFields, "metadata"> & { metadata: unknown }): unknown {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export class PrismaAuditRepository implements AuditRepository {
  async append(input: AuditEntryInput): Promise<AuditEntry> {
    const metadata = (sanitize(input.metadata ?? {}) ?? {}) as Prisma.InputJsonValue;
    const key = env().AUDIT_HMAC_KEY;

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_ID})`;
      const last = await tx.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
      const prevHash = last?.hash ?? GENESIS_HASH;

      const { metadata: _raw, ...fields } = input;
      const base: HashedFields = { id: crypto.randomUUID(), createdAt: new Date(), ...fields, metadata };
      const hash = computeHash(key, prevHash, hashPayload(base));

      const row = await tx.auditLog.create({ data: { ...base, prevHash, hash } });
      const { seq: _seq, ...entry } = row;
      return { ...entry, actorRole: entry.actorRole as Role | null };
    });
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAt: string | null }> {
    const key = env().AUDIT_HMAC_KEY;
    let prev = GENESIS_HASH;
    let cursor = 0n;
    for (;;) {
      const rows = await prisma.auditLog.findMany({
        where: { seq: { gt: cursor } },
        orderBy: { seq: "asc" },
        take: 500,
      });
      if (rows.length === 0) return { valid: true, brokenAt: null };
      for (const { seq, prevHash, hash, ...rest } of rows) {
        if (prevHash !== prev || computeHash(key, prevHash, hashPayload(rest)) !== hash) {
          return { valid: false, brokenAt: rest.id };
        }
        prev = hash;
        cursor = seq;
      }
    }
  }
}
