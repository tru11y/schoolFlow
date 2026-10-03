export type InvoiceStatusValue = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export interface Balance {
  amountCents: number;
  paidCents: number;
}

export const remaining = (i: Balance): number => Math.max(0, i.amountCents - i.paidCents);

/** Status shown to users, derived so it stays right even if no job has run since the due date. */
export function effectiveStatus(i: Balance & { dueDate: Date }, today: Date): InvoiceStatusValue {
  if (remaining(i) === 0) return "PAID";
  if (i.dueDate < today) return "OVERDUE";
  return i.paidCents > 0 ? "PARTIAL" : "PENDING";
}

export interface OpenInvoice {
  id: string;
  dueDate: Date;
  remainingCents: number;
}

export type Allocation = { invoiceId: string; amountCents: number };

/** Spreads a payment over open invoices, oldest due date first. `leftoverCents` > 0 means an overpayment. */
export function allocatePayment(invoices: OpenInvoice[], amountCents: number): { allocations: Allocation[]; leftoverCents: number } {
  let left = amountCents;
  const allocations: Allocation[] = [];
  for (const inv of [...invoices].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())) {
    if (left <= 0) break;
    const take = Math.min(left, inv.remainingCents);
    if (take > 0) {
      allocations.push({ invoiceId: inv.id, amountCents: take });
      left -= take;
    }
  }
  return { allocations, leftoverCents: left };
}

/** "YYYY-MM" of a "YYYY-MM-DD" local date. */
export const periodOf = (localDate: string): string => localDate.slice(0, 7);

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS[Number(month) - 1] ?? period} ${year}`;
}

/** Monthly fees are due on this day of the month. */
export const DUE_DAY = 10;

export const periodDueDate = (period: string): Date => new Date(`${period}-${String(DUE_DAY).padStart(2, "0")}T00:00:00.000Z`);

export interface MonthlyPlan {
  amountCents: number;
  carriedOverCents: number;
  carriedInvoiceIds: string[];
}

/** New amount due = monthly fee + remaining balances of the previous invoices (which are then marked as carried). */
export function planMonthlyInvoice(feeCents: number, previousOpen: (Balance & { id: string })[]): MonthlyPlan {
  const open = previousOpen.filter((i) => remaining(i) > 0);
  const carriedOverCents = open.reduce((sum, i) => sum + remaining(i), 0);
  return { amountCents: feeCents + carriedOverCents, carriedOverCents, carriedInvoiceIds: open.map((i) => i.id) };
}

/** Status to persist after a payment was applied. */
export function statusAfterPayment(i: Balance & { dueDate: Date }, today: Date): InvoiceStatusValue {
  return effectiveStatus(i, today);
}
