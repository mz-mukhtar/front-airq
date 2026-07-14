import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl, SERVER_API_VERSION } from "@/lib/api/server-config";

const SESSION_COOKIE = "aq_session";
const DEFAULT_MAX_AGE_SECONDS = 1800;

/** Paths whose 200 responses carry a token to capture into the session cookie. */
const TOKEN_ISSUING_PATHS = new Set([
  "auth/login",
  "auth/refresh",
  "auth/google/exchange",
]);

const LOGOUT_PATH = "auth/logout";

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

    const contentType = request.headers.get("content-type") || "application/json";

    const headers: Record<string, string> = {};
    if (method !== "GET" && method !== "DELETE") {
      headers["Content-Type"] = contentType;
    }

    // Prefer an explicit Authorization header; otherwise use the session cookie
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    } else {
      const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }
    }

    let body: string | undefined;
    if (method !== "GET" && method !== "DELETE") {
      try {
        body = await request.text();
      } catch {
        // no body
      }
    }

    const response = await fetch(url, { method, headers, body });

    const normalizedPath = apiPath.replace(/\/+$/, "").toLowerCase();
    const isLogout = normalizedPath === LOGOUT_PATH;
    const isTokenIssuing = TOKEN_ISSUING_PATHS.has(normalizedPath);

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
    return NextResponse.json(
      { detail: "Upstream request failed" },
      { status: 502 }
    );
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
