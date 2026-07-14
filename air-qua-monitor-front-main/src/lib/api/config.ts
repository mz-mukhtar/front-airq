// Client-side API config — requests go through the Next.js proxy (no backend URL in the browser).
// The session token lives in an httpOnly cookie set by the proxy; the browser never sees it.

export const API_PROXY_BASE = "/api/proxy";

/** Build same-origin proxy URL from an API path like `/locations` or `/sensor-readings?hours=24`. */
export function buildProxyUrl(endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_PROXY_BASE}/${path}`;
}

// Legacy "user_data" localStorage key. Nothing writes it anymore (the Zustand
// auth-storage persistence is the only user cache); this only clears the stale
// key left behind for existing users.
const USER_STORAGE_KEY = "user_data";

export const removeStoredUser = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_STORAGE_KEY);
};
