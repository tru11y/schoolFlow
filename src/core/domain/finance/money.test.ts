import { describe, expect, it } from "vitest";
import { formatMoney, toMinorUnits } from "./money";

describe("money", () => {
  it("formats per currency exponent", () => {
    expect(formatMoney(25000, "FCFA")).toBe("25 000 FCFA");
    expect(formatMoney(12050, "EUR")).toBe("120,50 €");
    expect(formatMoney(12050, "CAD", "code")).toBe("120,50 CAD");
    expect(formatMoney(1234567, "FCFA", "code")).toBe("1 234 567 FCFA");
  });

  it("falls back to EUR for unknown codes", () => {
    expect(formatMoney(100, "XXX")).toBe("1,00 €");
  });

  it("converts major units to minor units", () => {
    expect(toMinorUnits(25000, "FCFA")).toBe(25000);
    expect(toMinorUnits(120.5, "USD")).toBe(12050);
  });
});
