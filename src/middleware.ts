import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "aq_session";

/**
 * Presence-only session gating: redirect to /login when the session cookie is
 * absent for protected routes. Real authorization stays on the backend — this
 * only avoids rendering authenticated shells for anonymous visitors.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/profile",
  "/settings",
  "/sensors",
  "/diagnostics",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/sensors/:path*",
    "/diagnostics/:path*",
  ],
};
