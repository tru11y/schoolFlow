import { describe, expect, it } from "vitest";
import { allocatePayment, applyAllocations, effectiveStatus, openInvoicesOf, reverseAllocations, periodDueDate, periodLabel, planMonthlyInvoice, remaining } from "./billing";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("effectiveStatus", () => {
  const today = d("2026-10-20");
  it("derives the status from payments and due date", () => {
    expect(effectiveStatus({ amountCents: 25000, paidCents: 25000, dueDate: d("2026-10-10") }, today)).toBe("PAID");
    expect(effectiveStatus({ amountCents: 25000, paidCents: 15000, dueDate: d("2026-10-10") }, today)).toBe("OVERDUE");
    expect(effectiveStatus({ amountCents: 25000, paidCents: 15000, dueDate: d("2026-10-30") }, today)).toBe("PARTIAL");
    expect(effectiveStatus({ amountCents: 25000, paidCents: 0, dueDate: d("2026-10-30") }, today)).toBe("PENDING");
  });
});

describe("allocatePayment", () => {
  const open = [
    { id: "new", dueDate: d("2026-10-10"), remainingCents: 25000 },
    { id: "old", dueDate: d("2026-09-10"), remainingCents: 10000 },
  ];
  it("pays the oldest invoice first, then the next", () => {
    expect(allocatePayment(open, 30000)).toEqual({
      allocations: [{ invoiceId: "old", amountCents: 10000 }, { invoiceId: "new", amountCents: 20000 }],
      leftoverCents: 0,
    });
  });
  it("reports an overpayment instead of losing money", () => {
    expect(allocatePayment(open, 40000).leftoverCents).toBe(5000);
    expect(allocatePayment([], 100).leftoverCents).toBe(100);
  });
});

describe("planMonthlyInvoice", () => {
  it("adds the previous remaining balances to the monthly fee (25 000 due, 15 000 paid -> 10 000 carried)", () => {
    const plan = planMonthlyInvoice(25000, [
      { id: "sep", amountCents: 25000, paidCents: 15000 },
      { id: "aug", amountCents: 25000, paidCents: 25000 },
    ]);
    expect(plan).toEqual({ amountCents: 35000, carriedOverCents: 10000, carriedInvoiceIds: ["sep"] });
  });
  it("is just the fee when nothing is owed", () => {
    expect(planMonthlyInvoice(25000, []).amountCents).toBe(25000);
  });
});

describe("periods", () => {
  it("labels and dates a period", () => {
    expect(periodLabel("2026-10")).toBe("Octobre 2026");
    expect(periodDueDate("2026-10").toISOString().slice(0, 10)).toBe("2026-10-10");
    expect(remaining({ amountCents: 5, paidCents: 9 })).toBe(0);
  });
});

describe("payment reversal", () => {
  const inv = (id: string, amountCents: number, paidCents: number, carriedToInvoiceId: string | null = null) => ({
    id, amountCents, paidCents, carriedOverCents: 0, carriedToInvoiceId, dueDate: d("2026-10-10"),
  });

  it("gives the paid amount back to the invoice", () => {
    const out = reverseAllocations([inv("a", 25000, 25000)], [{ invoiceId: "a", amountCents: 25000 }]);
    expect(out[0]).toMatchObject({ paidCents: 0, amountCents: 25000 });
    expect(remaining(out[0]!)).toBe(25000);
  });

  it("restores the debt on the newer invoice when the paid one was carried over", () => {
    const out = reverseAllocations(
      [inv("sep", 25000, 15000, "oct"), inv("oct", 35000, 0)],
      [{ invoiceId: "sep", amountCents: 15000 }],
    );
    expect(out.find((i) => i.id === "sep")?.paidCents).toBe(0);
    expect(out.find((i) => i.id === "oct")).toMatchObject({ amountCents: 50000, carriedOverCents: 15000 });
  });

  it("edit = reverse then reallocate on open invoices only", () => {
    const reversed = reverseAllocations(
      [inv("sep", 25000, 25000, "oct"), inv("oct", 25000, 0)],
      [{ invoiceId: "sep", amountCents: 25000 }],
    );
    const { allocations, leftoverCents } = allocatePayment(openInvoicesOf(reversed), 10000);
    expect(allocations).toEqual([{ invoiceId: "oct", amountCents: 10000 }]);
    expect(leftoverCents).toBe(0);
    expect(applyAllocations(reversed, allocations).find((i) => i.id === "oct")?.paidCents).toBe(10000);
  });
});
