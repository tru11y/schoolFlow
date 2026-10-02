import type { Principal } from "../../domain/auth/principal";
import { ForbiddenError } from "../../domain/errors";
import { can, type Permission } from "../../domain/rbac/role";

export function assertPermission(principal: Principal, permission: Permission): void {
  if (!can(principal.role, permission)) throw new ForbiddenError(permission);
}
