import type { Role } from "../rbac/role";

export interface Principal {
  sessionId: string;
  userId: string;
  schoolId: string | null;
  role: Role;
}
