/**
 * Where a successful sign-in sends you.
 *
 * One module so password login and invitation sign-up cannot drift apart —
 * they used to land on different pages, and none of them read the `?next=` the
 * middleware had gone to the trouble of setting.
 */

/** Landing spot when there is no `?next=` to honour. */
export const DEFAULT_POST_LOGIN_ROUTE = "/dashboard";

/** True if the string contains a C0/C1 control character. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a `?next=` value before redirecting to it.
 *
 * Only same-origin *paths* are accepted. An attacker-supplied `next` is the
 * classic open-redirect: `//evil.com` and `/\evil.com` are both read as
 * protocol-relative URLs by browsers and by next/router, and `https://evil.com`
 * is obviously absolute — all of them would hand a freshly-authenticated user
 * to another site. Anything that isn't a plain `/path` falls back to the
 * default rather than being sanitised, because a half-cleaned redirect target
 * is not worth the risk.
 */
export function resolvePostLoginRoute(next: string | null | undefined): string {
  if (!next) return DEFAULT_POST_LOGIN_ROUTE;

  // Must be a root-relative path...
  if (!next.startsWith("/")) return DEFAULT_POST_LOGIN_ROUTE;
  // ...and not a protocol-relative URL ("//host" or "/\host").
  if (next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_POST_LOGIN_ROUTE;
  // Control characters (tab, newline, NUL) can smuggle a scheme past the checks
  // above once a browser strips them out of the URL.
  if (hasControlChars(next)) return DEFAULT_POST_LOGIN_ROUTE;
  // Sending someone back to the login page after logging in is a loop.
  if (next === "/login" || next.startsWith("/login?")) return DEFAULT_POST_LOGIN_ROUTE;

  return next;
}
