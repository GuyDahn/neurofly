import { LOCALES, localePath, type Locale } from "../i18n/locales.js";
import { LESSONS } from "../viewer/modules.js";
import { absoluteUrl, languageAlternates } from "./page-meta.js";
import { SITE_URL } from "./site.js";

export type SitemapPage = {
  /** The page without its language, e.g. /about. */
  path: string;
  /** Files, from the app folder, whose changes change the page. */
  sources: string[];
};

/** Every public page. The simulator bench is a developer tool and stays out. */
export const SITEMAP_PAGES: readonly SitemapPage[] = [
  { path: "/", sources: ["app/[locale]/page.tsx"] },
  ...LESSONS.map((entry) => ({
    path: entry.path,
    sources: [
      "app/[locale]/modules/[id]/page.tsx",
      `content/modules/${entry.id}.json`,
      `content/${entry.module.circuit}/module.json`,
    ],
  })),
  { path: "/about", sources: ["app/[locale]/about/page.tsx"] },
];

/** A page's words live in its language's messages file, so that counts as a source too. */
export function pageSources(page: SitemapPage, locale: Locale): string[] {
  return [...page.sources, `messages/${locale}.json`];
}

export function sitemapUrl(locale: Locale): string {
  return `${SITE_URL}/sitemaps/${locale}.xml`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** /sitemap.xml: one sitemap per language. */
export function sitemapIndexXml(
  lastmods: ReadonlyMap<Locale, string | null>,
): string {
  const entries = LOCALES.map((locale) => {
    const lastmod = lastmods.get(locale);
    return [
      "  <sitemap>",
      `    <loc>${escapeXml(sitemapUrl(locale))}</loc>`,
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      "  </sitemap>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</sitemapindex>",
    "",
  ].join("\n");
}

/** One language's pages, each listing every language's copy of itself. */
export function localeSitemapXml(
  locale: Locale,
  lastmod: (page: SitemapPage) => string | null,
): string {
  const urls = SITEMAP_PAGES.map((page) => {
    const modified = lastmod(page);
    const alternates = Object.entries(languageAlternates(page.path)).map(
      ([hreflang, href]) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
    );
    return [
      "  <url>",
      `    <loc>${escapeXml(absoluteUrl(localePath(locale, page.path)))}</loc>`,
      ...(modified ? [`    <lastmod>${escapeXml(modified)}</lastmod>`] : []),
      ...alternates,
      "  </url>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
