import { ForbiddenError } from "../errors";
import type { Principal } from "./principal";

/** Returns the schoolId every query must be restricted to, or null for platform-wide access (SUPER_ADMIN). */
export function tenantId(principal: Principal): string | null {
  if (principal.role === "SUPER_ADMIN") return null;
  if (!principal.schoolId) throw new ForbiddenError("tenant:missing");
  return principal.schoolId;
}

export function assertSameTenant(principal: Principal, resourceSchoolId: string | null): void {
  const tenant = tenantId(principal);
  if (tenant !== null && tenant !== resourceSchoolId) throw new ForbiddenError("tenant:mismatch");
}

type Args = Record<string, unknown>;

const WHERE_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany",
]);

/**
 * Adds the tenant filter at the top level of `where` (so unique selectors stay valid for
 * findUnique/update/upsert). A caller-supplied `schoolId` is overridden.
 */
function scopeWhere(args: Args, schoolId: string): Args {
  return { ...args, where: { ...(args.where as Args | undefined), schoolId } };
}

/** Pure tenant-scoping of Prisma operation args. Unknown operations are denied. */
export function applyTenantScope(operation: string, args: Args | undefined, schoolId: string): Args {
  const a = args ?? {};
  if (WHERE_OPS.has(operation)) return scopeWhere(a, schoolId);
  if (operation === "create") return { ...a, data: { ...(a.data as Args), schoolId } };
  if (operation === "createMany") {
    const rows = Array.isArray(a.data) ? (a.data as Args[]) : [a.data as Args];
    return { ...a, data: rows.map((r) => ({ ...r, schoolId })) };
  }
  if (operation === "upsert") {
    return { ...scopeWhere(a, schoolId), create: { ...(a.create as Args), schoolId } };
  }
  throw new ForbiddenError(`tenant:unsupported-op:${operation}`);
}
