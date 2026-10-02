import { createHash } from "node:crypto";

export interface ReceiptFacts {
  invoiceId: string;
  schoolId: string;
  studentId: string;
  amountCents: number;
  paidAt: Date;
}

/** SHA-256 over a fixed-order serialization of the facts a receipt certifies. */
export function receiptHash(f: ReceiptFacts): string {
  const payload = [f.invoiceId, f.schoolId, f.studentId, f.amountCents, f.paidAt.toISOString()].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function formatEuros(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} EUR`;
}
