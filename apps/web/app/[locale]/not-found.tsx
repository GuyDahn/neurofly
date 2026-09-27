import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { localePath } from "@/src/i18n/locales";
import { SiteFooter } from "@/src/site/footer";
import { SiteHeader } from "@/src/site/header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: { absolute: t("meta.notFoundTitle") } };
}

/** A missing page, in the language its URL asked for. */
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });
  return (
    <>
      <SiteHeader locale={locale} path="/" />
      <main
        id="main"
        className="mx-auto flex min-h-[50dvh] max-w-3xl flex-col items-start justify-center gap-4 px-4 py-16 sm:px-6"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
          {t("errors.notFound.title")}
        </h1>
        <p className="text-lg leading-relaxed text-fg-muted">
          {t("errors.notFound.body")}
        </p>
        <Link
          href={localePath(locale, "/")}
          className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-base font-semibold text-accent-fg transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("errors.notFound.home")}
        </Link>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
