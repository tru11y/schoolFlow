import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/presentation/auth/cookie-config";

const isPublic = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/verify/") || pathname.startsWith("/api/cron/");

/**
 * Edge gate: cheap presence check only (Prisma cannot run on the edge).
 * Real session validation happens in `requireAuth` / `requirePermission`.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname) || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
