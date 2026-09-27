import type {
  BreadcrumbList,
  Graph,
  LearningResource,
  Organization,
  Person,
  WebSite,
} from "schema-dts";
import { localePath, type Locale } from "../i18n/locales.js";
import { absoluteUrl } from "./page-meta.js";
import { AUTHOR, REPO_URL, SITE_NAME, SITE_URL } from "./site.js";

const WEBSITE_ID = `${SITE_URL}/#website`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const PERSON_ID = `${SITE_URL}/#person`;

function person(): Person {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    url: AUTHOR.website,
    address: {
      "@type": "PostalAddress",
      addressLocality: AUTHOR.city,
      addressCountry: "IL",
    },
    sameAs: [AUTHOR.github],
  };
}

function organization(): Organization {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/apple-icon.png`,
    founder: { "@id": PERSON_ID },
    sameAs: [REPO_URL],
  };
}

/** Where a page sits under the home page, in the reader's language. */
export function breadcrumbs(
  locale: Locale,
  trail: readonly { name: string; path: string }[],
): BreadcrumbList {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(localePath(locale, crumb.path)),
    })),
  };
}

/** The home page: the site, the project behind it, and its author. */
export function homeJsonLd({
  locale,
  description,
}: {
  locale: Locale;
  description: string;
}): Graph {
  const website: WebSite = {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl(localePath(locale, "/")),
    name: SITE_NAME,
    description,
    inLanguage: locale,
    isAccessibleForFree: true,
    publisher: { "@id": ORGANIZATION_ID },
    author: { "@id": PERSON_ID },
    creator: { "@id": PERSON_ID },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      website,
      organization(),
      person(),
      breadcrumbs(locale, [{ name: SITE_NAME, path: "/" }]),
    ],
  };
}

/** Any other page: where it sits, plus whatever the page itself is. */
export function pageJsonLd(
  locale: Locale,
  trail: readonly { name: string; path: string }[],
  ...nodes: (LearningResource | Person | Organization)[]
): Graph {
  return {
    "@context": "https://schema.org",
    "@graph": [...nodes, breadcrumbs(locale, trail)],
  };
}

export function lessonJsonLd({
  locale,
  path,
  name,
  description,
  teaches,
  educationalLevel,
  learningResourceType,
  audience,
  keywords,
}: {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  teaches: string;
  educationalLevel: string;
  learningResourceType: string;
  audience: string;
  keywords: string[];
}): LearningResource {
  return {
    "@type": "LearningResource",
    "@id": `${absoluteUrl(localePath(locale, path))}#lesson`,
    url: absoluteUrl(localePath(locale, path)),
    name,
    description,
    teaches,
    inLanguage: locale,
    educationalLevel,
    learningResourceType,
    audience: { "@type": "EducationalAudience", educationalRole: audience },
    isAccessibleForFree: true,
    interactivityType: "active",
    timeRequired: "PT10M",
    keywords: keywords.join(", "),
    isPartOf: { "@id": WEBSITE_ID },
    author: { "@type": "Person", "@id": PERSON_ID, name: AUTHOR.name },
    publisher: {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
    },
  };
}

/** JSON for an inline script tag, with `<` escaped so the data can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
