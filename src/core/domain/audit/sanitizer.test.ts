import { describe, expect, it } from "vitest";
import { REDACTED, sanitize } from "./sanitizer";

describe("sanitize", () => {
  it("redacts sensitive keys at any depth", () => {
    const out = sanitize({ a: { password: "x", apiKey: "y", ok: 1 }, list: [{ token: "t" }] });
    expect(out).toEqual({ a: { password: REDACTED, apiKey: REDACTED, ok: 1 }, list: [{ token: REDACTED }] });
  });

  it("redacts secrets embedded in strings", () => {
    expect(sanitize("Authorization: Bearer abcdefghijkl1234")).toBe(`Authorization: ${REDACTED}`);
    expect(sanitize("card 4111 1111 1111 1111")).toBe(`card ${REDACTED}`);
  });

  it("handles circular refs", () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(sanitize(o)).toEqual({ self: "[CIRCULAR]" });
  });
});
