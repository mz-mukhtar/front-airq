import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl, SERVER_API_VERSION } from "@/lib/api/server-config";

const SESSION_COOKIE = "aq_session";
const DEFAULT_MAX_AGE_SECONDS = 1800;

/** Paths whose 200 responses carry a token to capture into the session cookie. */
const TOKEN_ISSUING_PATHS = new Set([
  "auth/login",
  "auth/refresh",
]);

const LOGOUT_PATH = "auth/logout";
const REFRESH_PATH = "auth/refresh";

const FORBIDDEN_SEGMENT_PATTERN = /(\.\.|\\|%2e|%2f|%5c|\0|%00)/i;

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

function setSessionCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

/** CSRF check: for state-changing methods, the Origin host (when present) must match our own host. */
function isCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host") ?? request.nextUrl.host;
    return originHost !== requestHost;
  } catch {
    // Unparseable Origin header — treat as cross-origin
    return true;
  }
}

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  // Hoisted out of the try so the failure path knows whether this was a logout.
  let isLogoutRequest = false;

  try {
    const pathArray = params?.path || [];

    if (pathArray.length === 0) {
      return NextResponse.json(
        { detail: "Invalid proxy path: path parameter is missing" },
        { status: 400 }
      );
    }

    // Reject path traversal / encoding tricks before building the upstream URL
    for (const segment of pathArray) {
      if (FORBIDDEN_SEGMENT_PATTERN.test(segment) || segment.includes("\0")) {
        return NextResponse.json(
          { detail: "Invalid proxy path" },
          { status: 400 }
        );
      }
    }

    // CSRF protection for state-changing methods
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
      isCrossOrigin(request)
    ) {
      return NextResponse.json(
        { detail: "Cross-origin request rejected" },
        { status: 403 }
      );
    }

    const baseUrl = getServerApiBaseUrl();
    const apiPath = pathArray.join("/");
    const path = "/" + apiPath;
    const searchParams = request.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";
    const url = `${baseUrl}/api/${SERVER_API_VERSION}${path}${queryString}`;

    if (process.env.NODE_ENV === "development") {
      console.log(`[Proxy] ${method} ${path}${queryString}`);
    }

    // Determined before the upstream call so the catch block below can still
    // clear the cookie when the backend is unreachable.
    const normalizedPathEarly = apiPath.replace(/\/+$/, "").toLowerCase();
    isLogoutRequest = normalizedPathEarly === LOGOUT_PATH;

    const contentType = request.headers.get("content-type") || "application/json";
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

    // A refresh with no session cannot succeed — /auth/refresh needs a valid
    // bearer token, and the cookie is the only place one can come from. The
    // client fires this on any 401, including the ambient /auth/me that every
    // anonymous visitor triggers on load, so answering here keeps a guaranteed
    // failure from becoming a round trip to the backend on every cold visit.
    if (!sessionToken && normalizedPathEarly === REFRESH_PATH) {
      return NextResponse.json(
        { detail: "No active session." },
        { status: 401 }
      );
    }

    const headers: Record<string, string> = {};

    // The session token comes from the httpOnly cookie and nowhere else. An
    // inbound Authorization header is NOT honoured: accepting one would give
    // page scripts an auth channel the cookie design deliberately denies them,
    // and nothing in this app sends one.
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }

    // Forward a body whenever the request actually carries one, rather than
    // deciding by method. Keying off the method silently dropped the payload
    // the day a DELETE grew one.
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        const raw = await request.text();
        body = raw.length > 0 ? raw : undefined;
      } catch {
        // no body
      }
    }
    if (body !== undefined) {
      headers["Content-Type"] = contentType;
    }

    const response = await fetch(url, { method, headers, body });

    const isLogout = isLogoutRequest;
    const isTokenIssuing = TOKEN_ISSUING_PATHS.has(normalizedPathEarly);

    if (response.status === 204) {
      const res = new NextResponse(null, { status: response.status });
      if (isLogout) clearSessionCookie(res);
      return res;
    }

    const responseHeaders: Record<string, string> = {};
    const upstreamContentType = response.headers.get("content-type");
    if (upstreamContentType) {
      responseHeaders["Content-Type"] = upstreamContentType;
    }
    const upstreamContentDisposition = response.headers.get("content-disposition");
    if (upstreamContentDisposition) {
      responseHeaders["Content-Disposition"] = upstreamContentDisposition;
    }
    const retryAfter = response.headers.get("Retry-After");
    if (response.status === 429 && retryAfter) {
      responseHeaders["Retry-After"] = retryAfter;
    }

    // Token-issuing auth endpoints are the only ones whose body must be parsed
    // and rewritten (capture access_token into the httpOnly cookie and strip
    // it from the browser payload). Everything else streams straight through.
    if (isTokenIssuing) {
      const data = await response.text();

      let jsonData: unknown;
      try {
        jsonData = data ? JSON.parse(data) : {};
      } catch {
        jsonData = !response.ok
          ? { detail: data || `HTTP ${response.status}: ${response.statusText}` }
          : data || {};
      }

      let sessionTokenToSet: { token: string; maxAge: number } | null = null;

      if (
        response.status === 200 &&
        jsonData &&
        typeof jsonData === "object"
      ) {
        const payload = jsonData as Record<string, unknown>;
        const accessToken = payload["access_token"];
        if (typeof accessToken === "string" && accessToken) {
          const expiresIn = payload["expires_in"];
          const maxAge =
            typeof expiresIn === "number" && expiresIn > 0
              ? Math.floor(expiresIn)
              : DEFAULT_MAX_AGE_SECONDS;
          sessionTokenToSet = { token: accessToken, maxAge };
          delete payload["access_token"];
          jsonData = payload;
        }
      }

      const res = NextResponse.json(jsonData, {
        status: response.status,
        headers:
          response.status === 429 && retryAfter
            ? { "Retry-After": retryAfter }
            : undefined,
      });

      if (sessionTokenToSet) {
        setSessionCookie(res, sessionTokenToSet.token, sessionTokenToSet.maxAge);
      }

      return res;
    }

    // Stream the upstream body through without buffering/re-parsing JSON.
    const res = new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

    // Clear the session cookie on logout regardless of upstream status
    if (isLogout) {
      clearSessionCookie(res);
    }

    return res;
  } catch (error: unknown) {
    // Log details server-side only; never relay internal error messages
    console.error("[Proxy] error:", error);
    const res = NextResponse.json(
      { detail: "Upstream request failed" },
      { status: 502 }
    );
    // Still end the browser session when logging out. Previously this path
    // returned without touching the cookie, so a backend outage left users
    // unable to log out at all — the cookie survived, the middleware kept
    // letting them into protected routes, and clicking "Log out" changed
    // nothing. Revoking the token upstream is best-effort; dropping the
    // browser's credential is not.
    if (isLogoutRequest) clearSessionCookie(res);
    return res;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  return handleRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  return handleRequest(request, params, "POST");
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  return handleRequest(request, params, "PUT");
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  return handleRequest(request, params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const params = await Promise.resolve(context.params);
  return handleRequest(request, params, "DELETE");
}
