import type { AuditEntry, AuditEntryInput } from "../../domain/audit/audit-entry";

export interface AuditRepository {
  /** Append-only. Implementations must sanitize metadata and chain hashes. */
  append(entry: AuditEntryInput): Promise<AuditEntry>;
  verifyChain(): Promise<{ valid: boolean; brokenAt: string | null }>;
}
