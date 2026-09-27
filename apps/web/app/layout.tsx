import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SiteAnalytics } from "@/src/site/analytics";
import { siteCopy } from "@/src/site/copy";
import { jsonLdScript, siteJsonLd } from "@/src/site/json-ld";
import { AUTHOR, SITE_NAME, SITE_URL } from "@/src/site/site";
import "./globals.css";

const copy = siteCopy();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: copy.meta.title,
    template: `%s · ${SITE_NAME}`,
  },
  description: copy.meta.description,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR.name, url: AUTHOR.website }],
  creator: AUTHOR.name,
  publisher: AUTHOR.name,
  category: "education",
  keywords: [
    "fruit fly brain",
    "connectome",
    "MaleCNS",
    "Drosophila",
    "neuroscience lesson",
    "biology classroom",
    "neurons simulation",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: copy.meta.title,
    description: copy.meta.description,
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd()) }}
        />
        <SiteAnalytics />
      </body>
    </html>
  );
}
