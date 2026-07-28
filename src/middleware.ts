import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "aq_session";

/**
 * Presence-only session gating: redirect to /login when the session cookie is
 * absent for protected routes. Real authorization stays on the backend — this
 * only avoids rendering authenticated shells for anonymous visitors.
 *
 * This list is the single mechanism for route protection. Pages must not
 * redirect anonymous visitors themselves — a client-side bounce runs after the
 * shell has already rendered and is invisible from here, which is how /alerts
 * drifted out of sync with its siblings.
 *
 * Deliberately absent: "/" and "/getting-started". The landing page carries the
 * public map and its own station list, and the guide explains them — those are
 * the anonymous browsing path. The station explorer at /stations is the
 * signed-in version and is gated with everything else.
 *
 * Keep in sync with `config.matcher` below.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/alerts",
  "/profile",
  "/settings",
  "/sensors",
  "/stations",
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

  // Carry the whole destination, query string included: bouncing someone off
  // /sensors?device=X and sending them back to a bare /sensors loses the thing
  // they actually clicked. `search` already starts with "?" when non-empty.
  const destination = `${pathname}${request.nextUrl.search}`;

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", destination);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/alerts/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/sensors/:path*",
    "/stations/:path*",
    "/diagnostics/:path*",
  ],
};
