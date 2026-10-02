import { describe, expect, it } from "vitest";
import { Argon2Hasher } from "./argon2-hasher";
import { MemoryRateLimiter } from "./memory-rate-limiter";
import { Sha256TokenCodec } from "./token-codec";

describe("Argon2Hasher", () => {
  const hasher = new Argon2Hasher();

  it("hashes with argon2id, verifies, and never throws on garbage", async () => {
    const hash = await hasher.hash("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await hasher.verify(hash, "correct horse battery")).toBe(true);
    expect(await hasher.verify(hash, "wrong")).toBe(false);
    expect(await hasher.verify("not-a-hash", "x")).toBe(false);
    expect(hasher.needsRehash(hash)).toBe(false);
  });
});

describe("Sha256TokenCodec", () => {
  it("produces unique high-entropy tokens whose hash is stable", () => {
    const codec = new Sha256TokenCodec();
    const a = codec.generate();
    const b = codec.generate();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
    expect(codec.hash(a.token)).toBe(a.hash);
    expect(a.hash).not.toContain(a.token);
  });
});

describe("MemoryRateLimiter", () => {
  it("blocks past the max, reports retry time, and recovers after the window", async () => {
    let now = 0;
    const rl = new MemoryRateLimiter(2, 10_000, () => now);
    expect((await rl.consume("k")).allowed).toBe(true);
    expect((await rl.consume("k")).allowed).toBe(true);
    expect(await rl.consume("k")).toEqual({ allowed: false, retryAfterSec: 10 });
    expect((await rl.consume("other")).allowed).toBe(true);
    now = 10_001;
    expect((await rl.consume("k")).allowed).toBe(true);
  });

  it("reset clears the counter", async () => {
    const rl = new MemoryRateLimiter(1, 10_000, () => 0);
    await rl.consume("k");
    await rl.reset("k");
    expect((await rl.consume("k")).allowed).toBe(true);
  });
});
