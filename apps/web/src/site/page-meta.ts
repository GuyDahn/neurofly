import type { Metadata } from "next";
import { siteCopy } from "./copy.js";
import { SITE_NAME } from "./site.js";

/**
 * Next.js replaces a parent's openGraph and twitter objects instead of merging
 * them, so every page builds both in full here, share image included.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  /** Page title. Undefined keeps the site's default title. */
  title?: string;
  description: string;
  path: string;
}): Metadata {
  const copy = siteCopy();
  const shareTitle = title ?? copy.meta.title;
  const image = {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: copy.meta.shareAlt,
    type: "image/png",
  };
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      title: shareTitle,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [image],
    },
  };
}
