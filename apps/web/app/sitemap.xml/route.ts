import { LOCALES, type Locale } from "@/src/i18n/locales";
import { lastModified, latest } from "@/src/site/lastmod";
import {
  pageSources,
  SITEMAP_PAGES,
  sitemapIndexXml,
} from "@/src/site/sitemap";

export const dynamic = "force-static";

/** The sitemap index robots.txt points at: one sitemap per language. */
export function GET() {
  const lastmods = new Map<Locale, string | null>(
    LOCALES.map((locale) => [
      locale,
      latest(
        SITEMAP_PAGES.map((page) => lastModified(pageSources(page, locale))),
      ),
    ]),
  );
  return new Response(sitemapIndexXml(lastmods), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
