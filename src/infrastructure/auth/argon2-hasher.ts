import argon2 from "argon2";
import type { PasswordHasher } from "@/core/application/ports/auth-ports";

const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export class Argon2Hasher implements PasswordHasher {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, OPTIONS);
  }

  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= argon2.hash("dummy-password-for-timing", OPTIONS);
    await this.verify(await this.dummyHash, password);
  }
}
