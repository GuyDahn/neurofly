import type { MetadataRoute } from "next";
import { LESSONS } from "../viewer/modules.js";
import { SITE_URL } from "./site.js";

/** Every public page. The simulator bench is a developer tool and stays out. */
export function sitemapEntries(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    ...LESSONS.map((entry) => ({
      url: `${SITE_URL}${entry.path}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
