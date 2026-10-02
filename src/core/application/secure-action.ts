import { z } from "zod";
import type { AuditEntryInput } from "../domain/audit/audit-entry";
import type { Principal } from "../domain/auth/principal";
import { tenantId } from "../domain/auth/tenant";
import { ForbiddenError } from "../domain/errors";
import type { Permission } from "../domain/rbac/role";
import type { AuditLogger } from "./audit-service";
import { assertPermission } from "./auth/authorize";

export type ActionErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> } };

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface SecureActionDeps<TDb> {
  getPrincipal(): Promise<Principal | null>;
  /** Client already restricted to the principal's tenant. */
  createDb(principal: Principal): TDb;
  audit: AuditLogger;
  getRequestContext(): Promise<RequestContext>;
  /** Runs work after the response is sent (Next `after`). Must not throw. */
  defer(task: () => Promise<void>): void;
  onError(err: unknown): void;
}

export interface SecureActionOptions<S extends z.ZodType, R> {
  /** Audit action name, e.g. "student.create". */
  name: string;
  resource: string;
  input: S;
  permission?: Permission;
  resourceId?: (input: z.output<S>, data: NoInfer<R>) => string | null;
  /** What goes into the audit entry instead of the raw input (use to keep personal data out of the log). */
  auditMetadata?: (input: z.output<S>, data: NoInfer<R> | undefined) => unknown;
  /** Stored in the audit metadata as `severity` on success (default: absent = INFO). */
  auditSeverity?: (input: z.output<S>, data: NoInfer<R>) => "INFO" | "WARNING";
}

export interface ActionContext<S extends z.ZodType, TDb> {
  principal: Principal;
  /** null for platform-wide access (SUPER_ADMIN). */
  schoolId: string | null;
  input: z.output<S>;
  db: TDb;
}

const MESSAGES: Record<ActionErrorCode, string> = {
  UNAUTHENTICATED: "Session expirée. Veuillez vous reconnecter.",
  FORBIDDEN: "Action non autorisée.",
  VALIDATION: "Données invalides.",
  INTERNAL: "Une erreur est survenue.",
};

const fail = (code: ActionErrorCode, fieldErrors?: Record<string, string[]>): ActionResult<never> => ({
  ok: false,
  error: { code, message: MESSAGES[code], ...(fieldErrors ? { fieldErrors } : {}) },
});

/** Next.js `redirect()` / `notFound()` signal through thrown errors; they must propagate. */
function isControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function createSecureAction<TDb>(deps: SecureActionDeps<TDb>) {
  return function secureAction<S extends z.ZodType, R>(
    options: SecureActionOptions<S, R>,
    handler: (ctx: ActionContext<S, TDb>) => Promise<R>,
  ): (rawInput: unknown) => Promise<ActionResult<R>> {
    return async (rawInput) => {
      const request = await deps.getRequestContext();

      const record = (
        principal: Principal | null,
        outcome: AuditEntryInput["outcome"],
        resourceId: string | null,
        metadata: unknown,
      ) =>
        deps.defer(() =>
          deps.audit.record({
            schoolId: principal?.schoolId ?? null,
            actorId: principal?.userId ?? null,
            actorRole: principal?.role ?? null,
            action: options.name,
            resource: options.resource,
            resourceId,
            outcome,
            ip: request.ip,
            userAgent: request.userAgent,
            metadata,
          }),
        );

      const principal = await deps.getPrincipal();
      if (!principal) {
        record(null, "DENIED", null, { reason: "unauthenticated" });
        return fail("UNAUTHENTICATED");
      }

      let schoolId: string | null;
      try {
        if (options.permission) assertPermission(principal, options.permission);
        schoolId = tenantId(principal);
      } catch (err) {
        if (!(err instanceof ForbiddenError)) throw err;
        record(principal, "DENIED", null, { reason: err.detail });
        return fail("FORBIDDEN");
      }

      const parsed = options.input.safeParse(rawInput);
      if (!parsed.success) {
        const fieldErrors = z.flattenError(parsed.error as z.ZodError).fieldErrors as Record<string, string[]>;
        record(principal, "FAILURE", null, { reason: "validation", fields: Object.keys(fieldErrors) });
        return fail("VALIDATION", fieldErrors);
      }
      const input = parsed.data as z.output<S>;
      const auditPayload = (data?: R) => ({
        ...(data !== undefined && options.auditSeverity ? { severity: options.auditSeverity(input, data) } : {}),
        input: options.auditMetadata ? options.auditMetadata(input, data) : input,
      });

      try {
        const data = await handler({ principal, schoolId, input, db: deps.createDb(principal) });
        record(principal, "SUCCESS", options.resourceId?.(input, data) ?? null, auditPayload(data));
        return { ok: true, data };
      } catch (err) {
        if (isControlFlow(err)) {
          record(principal, "SUCCESS", null, auditPayload());
          throw err;
        }
        if (err instanceof ForbiddenError) {
          record(principal, "DENIED", null, { reason: err.detail });
          return fail("FORBIDDEN");
        }
        deps.onError(err);
        record(principal, "FAILURE", null, { reason: "exception", error: err instanceof Error ? err.name : "unknown" });
        return fail("INTERNAL");
      }
    };
  };
}
