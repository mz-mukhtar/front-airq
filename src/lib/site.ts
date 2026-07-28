import type { Metadata } from "next";

/**
 * Canonical site identity, in one place.
 *
 * SITE_URL matters more than it looks: Next resolves every relative metadata
 * URL (canonical, OG images, twitter images) against `metadataBase`. When that
 * is unset, Next does NOT fail the build — it emits a warning and falls back to
 * `http://localhost:3000`, and on a self-hosted deployment (no VERCEL_* env
 * vars) that fallback is what ships. Every social preview would point at
 * localhost. So this value is required, not decorative.
 */
export const SITE_URL = (
  // The www host, because that is the one that actually serves a 200: the apex
  // 308-redirects to it. A canonical must point at the URL a crawler lands on,
  // not at one that bounces back — declaring the apex here told Google "the
  // canonical version of this page is a URL that redirects to this page",
  // which is a contradiction it has to guess its way out of.
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.addisairnet.et"
).replace(/\/$/, "");

export const SITE_NAME = "Addis Air Net";

export const SITE_TAGLINE = "Real-time air quality monitoring for Addis Ababa";

/**
 * Shared Open Graph fields.
 *
 * Next merges metadata *shallowly*: a route that declares its own `openGraph`
 * replaces the parent's entire object rather than merging into it, silently
 * dropping siteName/locale/images. Route layouts spread this instead of
 * redeclaring those fields.
 */
export const OG_BASE: Pick<
  NonNullable<Metadata["openGraph"]>,
  "siteName" | "locale" | "images"
> & { type: "website" } = {
  siteName: SITE_NAME,
  locale: "en_US",
  type: "website",
  images: [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
    },
  ],
};

/** Routes that should be crawled and appear in the sitemap. */
export const PUBLIC_ROUTES = ["/", "/getting-started"] as const;

/**
 * Routes kept out of the index. These are either authenticated shells (no
 * useful content for a crawler, and indexing them wastes crawl budget on
 * pages that redirect) or credential flows that should never surface in search.
 */
export const NON_INDEXED_PATHS = [
  "/dashboard",
  "/admin",
  "/alerts",
  "/diagnostics",
  "/profile",
  "/settings",
  "/sensors",
  "/stations",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/auth/",
  "/api/",
] as const;
