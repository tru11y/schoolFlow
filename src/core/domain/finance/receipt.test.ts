import { describe, expect, it } from "vitest";
import { receiptHash } from "./receipt";

const facts = { paymentId: "p", schoolId: "s", studentId: "u", amountCents: 5000, paidAt: new Date("2026-01-01T00:00:00Z") };

describe("receiptHash", () => {
  it("is a stable 64-char SHA-256 hex", () => {
    expect(receiptHash(facts)).toMatch(/^[0-9a-f]{64}$/);
    expect(receiptHash(facts)).toBe(receiptHash({ ...facts }));
  });

  it("changes when any certified fact changes", () => {
    expect(receiptHash({ ...facts, amountCents: 5001 })).not.toBe(receiptHash(facts));
    expect(receiptHash({ ...facts, studentId: "v" })).not.toBe(receiptHash(facts));
  });
});
