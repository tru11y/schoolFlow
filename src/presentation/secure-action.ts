import { headers } from "next/headers";
import { after } from "next/server";
import { createSecureAction } from "@/core/application/secure-action";
import { tenantPrisma } from "@/infrastructure/db/tenant-prisma";
import { container } from "./auth/container";
import { getPrincipal } from "./auth/guards";

/**
 * Wrap every Server Action with this: authn, authz, Zod validation, tenant-scoped `db`,
 * and an immutable audit entry written after the response.
 */
export const secureAction = createSecureAction({
  getPrincipal,
  createDb: tenantPrisma,
  audit: { record: (entry) => container().audit.record(entry) },
  async getRequestContext() {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    };
  },
  defer: (task) => after(task),
  onError: (err) => console.error("server action failed", err),
});
