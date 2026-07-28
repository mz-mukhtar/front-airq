import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * XML sitemap for the public pages.
 *
 * Only routes that are genuinely public and genuinely useful to a searcher.
 * Authenticated routes are excluded here as well as in robots.ts — listing a
 * page that redirects to /login is a way to teach a crawler to distrust the
 * sitemap.
 *
 * `changeFrequency` reflects reality: the map carries live readings and changes
 * every few minutes; the explainer page changes rarely. Overstating it on
 * static pages is a well-known way to have the whole file discounted.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/getting-started`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
