import type { Metadata, Viewport } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { direction, LOCALES } from "@/src/i18n/locales";
import { pageLocale, type LocaleParams } from "@/src/i18n/server";
import { SiteAnalytics } from "@/src/site/analytics";
import { ERROR_COPY_ID, type ErrorCopy } from "@/src/site/error-copy";
import { jsonLdScript } from "@/src/site/json-ld";
import { AUTHOR, SITE_NAME, SITE_URL } from "@/src/site/site";
import { THEME_INIT_SCRIPT } from "@/src/site/theme";
import "../globals.css";

// Every live language is built ahead of time. The middleware sends anything
// else to a real page before it gets here.
export const dynamicParams = false;

export function generateStaticParams(): LocaleParams[] {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    authors: [{ name: AUTHOR.name, url: AUTHOR.website }],
    creator: AUTHOR.name,
    publisher: AUTHOR.name,
    category: "education",
    manifest: `/${locale}/manifest.webmanifest`,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<LocaleParams>;
}) {
  const locale = await pageLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "errors.error" });
  const errorCopy: ErrorCopy = {
    title: t("title"),
    body: t("body"),
    retry: t("retry"),
    home: t("home"),
  };
  // No translation runtime rides along here: the lessons bring their own, so
  // the landing page ships none. The error pages read their four strings
  // from this inert JSON instead.
  return (
    // The inline theme script sets the `dark` class before hydration, which
    // never matches this server render; suppress the expected mismatch.
    <html lang={locale} dir={direction(locale)} suppressHydrationWarning>
      <body className="bg-canvas text-fg antialiased">
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
        <script
          id={ERROR_COPY_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(errorCopy) }}
        />
        <SiteAnalytics />
      </body>
    </html>
  );
}
