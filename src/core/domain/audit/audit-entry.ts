import type { Role } from "../rbac/role";

export interface AuditEntryInput {
  schoolId: string | null;
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  resource: string;
  resourceId: string | null;
  outcome: "SUCCESS" | "DENIED" | "FAILURE";
  ip: string | null;
  userAgent: string | null;
  metadata?: unknown;
}

export interface AuditEntry extends Omit<AuditEntryInput, "metadata"> {
  id: string;
  createdAt: Date;
  metadata: unknown;
  prevHash: string;
  hash: string;
}
