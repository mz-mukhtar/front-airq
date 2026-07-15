/** Server-only backend URL — never import from client components. */
export function getServerApiBaseUrl(): string {
  const url = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error("API_BASE_URL environment variable is not set");
  }
  return url.replace(/\/$/, "");
}

export const SERVER_API_VERSION = "v1";
