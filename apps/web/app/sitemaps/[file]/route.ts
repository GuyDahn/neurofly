import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/src/i18n/locales";
import { lastModified } from "@/src/site/lastmod";
import { localeSitemapXml, pageSources } from "@/src/site/sitemap";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { file: string }[] {
  return LOCALES.map((locale) => ({ file: `${locale}.xml` }));
}

/** /sitemaps/he.xml: every Hebrew page, with its copies in every other language. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const locale = file.replace(/\.xml$/, "");
  if (!isLocale(locale)) notFound();
  const xml = localeSitemapXml(locale, (page) =>
    lastModified(pageSources(page, locale)),
  );
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
