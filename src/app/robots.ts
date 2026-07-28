import type { MetadataRoute } from "next";
import { NON_INDEXED_PATHS, SITE_URL } from "@/lib/site";

/**
 * Crawl rules.
 *
 * The disallow list is the authenticated surface plus the credential flows.
 * Those routes render a loading shell and then redirect, so letting a crawler
 * spend budget on them buys nothing and risks thin-content pages in the index.
 *
 * `/stations` and `/getting-started` are deliberately crawlable — they are the
 * public pages the landing map links into.
 */
export default function robots(): MetadataRoute.Robots {
  // A staging or preview deployment must never compete with production for the
  // same queries; duplicate content across hosts splits ranking signals.
  // Matched on hostname rather than the full string so that switching between
  // the apex and www — or adding a trailing slash — cannot silently turn the
  // production site non-indexable.
  const isProduction = /(^|\.)addisairnet\.et$/.test(new URL(SITE_URL).hostname);

  if (!isProduction) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...NON_INDEXED_PATHS],
      },
    ],
    // Absolute URL required — metadataBase does not apply to this file.
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
