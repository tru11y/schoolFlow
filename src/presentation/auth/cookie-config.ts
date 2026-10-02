const isProd = process.env.NODE_ENV === "production";

/** `__Host-` prefix (prod) pins the cookie to the exact host, Secure, path=/, no Domain. */
export const SESSION_COOKIE = isProd ? "__Host-sf_session" : "sf_session";

export const sessionCookieOptions = (expires: Date) =>
  ({
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires,
  }) as const;
