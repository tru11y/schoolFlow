import type { RateLimiter } from "@/core/application/ports/auth-ports";

/**
 * Sliding-window limiter. Process-local: swap for a Redis implementation
 * of `RateLimiter` when running more than one instance.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async consume(key: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);

    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return { allowed: false, retryAfterSec: Math.ceil((oldest + this.windowMs - now) / 1000) };
    }

    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.evictExpired(now);
    return { allowed: true, retryAfterSec: 0 };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  private evictExpired(now: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(key);
    }
  }
}
