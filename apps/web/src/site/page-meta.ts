import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localePath,
  OG_LOCALES,
  type Locale,
} from "../i18n/locales.js";
import { SITE_NAME, SITE_URL } from "./site.js";

/** Pages with their own share image. */
export type SharePage = "home" | "about" | `lesson-${string}`;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * Every language's copy of a page, for hreflang in the head and in the
 * sitemaps. `x-default` is the language-picking root for the home page and
 * the English page everywhere else.
 */
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] = absoluteUrl(localePath(locale, path));
  }
  languages["x-default"] =
    path === "/"
      ? `${SITE_URL}/`
      : absoluteUrl(localePath(DEFAULT_LOCALE, path));
  return languages;
}

/** The share image for a page in one language, e.g. /og/he/about.png. */
export function shareImagePath(
  locale: Locale,
  page: SharePage,
  version: string,
): string {
  return `/og/${locale}/${page}.png?v=${version}`;
}

/**
 * Next.js replaces a parent's openGraph and twitter objects instead of merging
 * them, so every page builds both in full here, share image included.
 */
export function pageMetadata({
  locale,
  path,
  title,
  shareTitle,
  description,
  image,
  imageAlt,
}: {
  locale: Locale;
  /** The page without its language, e.g. /about. */
  path: string;
  /** The whole <title>, at most 60 characters. */
  title: string;
  /** The title on share cards, which show the site name on their own. */
  shareTitle: string;
  /** At most 155 characters. */
  description: string;
  image: string;
  imageAlt: string;
}): Metadata {
  const url = absoluteUrl(localePath(locale, path));
  const card = {
    url: image,
    width: 1200,
    height: 630,
    alt: imageAlt,
    type: "image/png",
  };
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map(
        (other) => OG_LOCALES[other],
      ),
      title: shareTitle,
      description,
      url,
      images: [card],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [card],
    },
  };
}
