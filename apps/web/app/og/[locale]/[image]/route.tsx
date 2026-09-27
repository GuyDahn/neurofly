import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/src/i18n/locales";
import { renderShareCard } from "@/src/og/card";
import { SHARE_PAGES } from "@/src/og/share-card";
import type { SharePage } from "@/src/site/page-meta";

// Built once per language and page at deploy time, then served as files.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { locale: string; image: string }[] {
  return LOCALES.flatMap((locale) =>
    SHARE_PAGES.map((page) => ({ locale, image: `${page}.png` })),
  );
}

/** /og/he/lesson-escape.png: a page's share image in one language. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; image: string }> },
) {
  const { locale, image } = await params;
  const page = image.replace(/\.png$/, "") as SharePage;
  if (!isLocale(locale) || !SHARE_PAGES.includes(page)) notFound();
  const response = await renderShareCard(locale, page);
  response.headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800",
  );
  return response;
}
