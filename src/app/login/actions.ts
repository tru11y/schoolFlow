"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { InvalidCredentialsError, RateLimitedError } from "@/core/domain/errors";
import { container } from "@/presentation/auth/container";
import { getPrincipal } from "@/presentation/auth/guards";
import { SESSION_COOKIE, sessionCookieOptions } from "@/presentation/auth/cookie-config";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  next: z.string().optional(),
});

export interface LoginState {
  error: string | null;
}

/** Same-origin relative paths only (blocks open redirects such as `//evil.com`). */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Identifiants invalides." };

  const h = await headers();
  try {
    const { token, expiresAt } = await container().login.execute({
      email: parsed.data.email,
      password: parsed.data.password,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      userAgent: h.get("user-agent"),
    });
    (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return { error: `Trop de tentatives. Réessayez dans ${Math.ceil(err.retryAfterSec / 60)} min.` };
    }
    if (err instanceof InvalidCredentialsError) return { error: "Identifiants invalides." };
    throw err;
  }
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await container().sessions.revoke(token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function logoutAllAction(): Promise<void> {
  const principal = await getPrincipal();
  if (principal) {
    const h = await headers();
    await container().sessions.revokeAll(principal.userId);
    await container().audit.record({
      schoolId: principal.schoolId, actorId: principal.userId, actorRole: principal.role,
      action: "USER_LOGOUT_ALL_DEVICES", resource: "session", resourceId: principal.sessionId, outcome: "SUCCESS",
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"), userAgent: h.get("user-agent"),
    });
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
