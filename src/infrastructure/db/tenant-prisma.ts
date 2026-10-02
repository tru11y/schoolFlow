import { applyTenantScope, tenantId } from "@/core/domain/auth/tenant";
import type { Principal } from "@/core/domain/auth/principal";
import { prisma } from "./prisma";

/** Models carrying a `schoolId` column. Every new tenant-owned model must be listed here. */
const TENANT_MODELS = new Set([
  "User", "Invoice", "AttendanceRecord", "Homework", "StudentProfile", "Course", "CourseEnrollment", "ParentContact", "TimetableSlot", "AttendanceSession", "GuardianLink",
]);

/** Prisma client whose queries on tenant models are automatically restricted to the principal's school. */
export function tenantPrisma(principal: Principal) {
  const schoolId = tenantId(principal);

  return prisma.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (schoolId === null || !TENANT_MODELS.has(model)) return query(args);
          return query(applyTenantScope(operation, args as Record<string, unknown>, schoolId) as typeof args);
        },
      },
    },
  });
}
