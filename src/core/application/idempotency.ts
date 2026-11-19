import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Garde anti-doublon pour les requêtes rejouées depuis la file hors-ligne.
 * `claim` réserve la clé (une seule fois) ; si le traitement échoue, `release`
 * la libère pour autoriser un nouveau rejeu.
 */
export async function claimKey(key: string): Promise<boolean> {
  if (!UUID_RE.test(key)) return true; // clé absente/malformée : pas de dédup, on laisse passer
  try {
    await prisma.idempotencyKey.create({ data: { key } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

export async function releaseKey(key: string): Promise<void> {
  try {
    await prisma.idempotencyKey.delete({ where: { key } });
  } catch {
    /* déjà absente : rien à faire */
  }
}
