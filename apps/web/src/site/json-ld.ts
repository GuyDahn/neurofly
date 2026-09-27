import { siteCopy } from "./copy.js";
import { AUTHOR, REPO_URL, SITE_NAME, SITE_URL } from "./site.js";

/** schema.org graph for every page: the site, the project behind it, and its author. */
export function siteJsonLd() {
  const copy = siteCopy();
  const website = `${SITE_URL}/#website`;
  const organization = `${SITE_URL}/#organization`;
  const person = `${SITE_URL}/#person`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": website,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        description: copy.meta.description,
        inLanguage: "en",
        isAccessibleForFree: true,
        publisher: { "@id": organization },
        author: { "@id": person },
        creator: { "@id": person },
      },
      {
        "@type": "Organization",
        "@id": organization,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/apple-icon.png`,
        founder: { "@id": person },
        sameAs: [REPO_URL],
      },
      {
        "@type": "Person",
        "@id": person,
        name: AUTHOR.name,
        jobTitle: AUTHOR.jobTitle,
        url: AUTHOR.website,
        address: {
          "@type": "PostalAddress",
          addressLocality: AUTHOR.city,
          addressCountry: "IL",
        },
        sameAs: [AUTHOR.github],
      },
    ],
  };
}

/** JSON for an inline script tag, with `<` escaped so the data can never close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
