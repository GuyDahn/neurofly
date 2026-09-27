import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/src/site/sitemap";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
