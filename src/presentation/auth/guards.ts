import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertPermission } from "@/core/application/auth/authorize";
import type { Principal } from "@/core/domain/auth/principal";
import { ForbiddenError } from "@/core/domain/errors";
import type { Permission } from "@/core/domain/rbac/role";
import { container } from "./container";
import { SESSION_COOKIE } from "./cookie-config";

/** Resolves the session from the cookie (DB-backed). Deduplicated per request. */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? container().sessions.validate(token) : null;
});

export async function requireAuth(): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) redirect("/login");
  return principal;
}

/** Page variant: unauthorized users are sent back to the dashboard instead of an error page. */
export async function requirePagePermission(permission: Permission): Promise<Principal> {
  try {
    return await requirePermission(permission);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/dashboard");
    throw err;
  }
}

/** Use at the top of every page, route handler and Server Action. Denials are audited. */
export async function requirePermission(permission: Permission): Promise<Principal> {
  const principal = await requireAuth();
  try {
    assertPermission(principal, permission);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      const h = await headers();
      await container().audit.record({
        schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
        action: "authz.denied", resource: "permission", resourceId: permission, outcome: "DENIED",
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, userAgent: h.get("user-agent"),
      });
    }
    throw err;
  }
  return principal;
}
