import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, ENDONYMS, LOCALES } from "@/src/i18n/locales";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: DEFAULT_LOCALE });
  return { title: { absolute: t("meta.notFoundTitle") } };
}

/**
 * A missing file or a path no language claims. There is no language to go
 * by, so it is in English and lists every language's home page.
 */
export default async function RootNotFound() {
  const t = await getTranslations({ locale: DEFAULT_LOCALE });
  return (
    <html lang={DEFAULT_LOCALE} dir="ltr">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {t("errors.notFound.title")}
          </h1>
          <p className="text-lg leading-relaxed text-zinc-300">
            {t("errors.notFound.body")}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-base">
            {LOCALES.map((locale) => (
              <li key={locale}>
                <a
                  href={`/${locale}`}
                  hrefLang={locale}
                  lang={locale}
                  className="text-zinc-200 underline decoration-white/30 underline-offset-4 hover:text-white"
                >
                  {ENDONYMS[locale]}
                </a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
