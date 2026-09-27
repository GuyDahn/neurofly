import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { direction, isLocale, LOCALES, localePath } from "@/src/i18n/locales";
import { SITE_NAME } from "@/src/site/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { locale: string }[] {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * /he/manifest.webmanifest: the installable app in one language. One `id`
 * for every language, so a classroom tablet installs WiredMind once.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "manifest" });
  const manifest = {
    id: "/",
    name: t("name"),
    short_name: SITE_NAME,
    description: t("description"),
    lang: locale,
    dir: direction(locale),
    start_url: localePath(locale, "/"),
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["education"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
