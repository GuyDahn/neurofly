import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { localePath, type Locale } from "../i18n/locales.js";
import { LINK_CLASS, richLinks, SiteLink } from "./rich-text.js";
import { AUTHOR, COFFEE_URL, LINKS, REPO_URL } from "./site.js";

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="me-1.5 inline-block size-3.5 fill-current align-[-0.125em]"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * The credit line on every page: who built it, where to help, and the
 * coffee link. Lessons swap the coffee link for the about page, so students
 * are never asked for anything mid-lesson.
 */
export async function CreditLine({
  locale,
  coffee,
}: {
  locale: Locale;
  coffee: boolean;
}) {
  const t = await getTranslations({ locale });
  const newTab = t("a11y.newTab");
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        href={`${localePath(locale, "/about")}#who-made-this`}
        className={LINK_CLASS}
      >
        {t("footer.builtBy", { author: AUTHOR.name })}
      </Link>
      <span aria-hidden="true">·</span>
      <SiteLink
        href={REPO_URL}
        newTab={newTab}
        label={t("footer.githubLabel")}
        title={t("footer.githubLabel")}
      >
        <GitHubIcon />
        {t("footer.github")}
      </SiteLink>
      <span aria-hidden="true">·</span>
      {coffee ? (
        <SiteLink href={COFFEE_URL} newTab={newTab}>
          {t("support.coffee")}
        </SiteLink>
      ) : (
        <Link href={localePath(locale, "/about")} className={LINK_CLASS}>
          {t("footer.about")}
        </Link>
      )}
    </p>
  );
}

/** Who mapped the neurons, with links to each institution and the license. */
export async function DataCredit({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  return (
    <p className="leading-relaxed">
      {t.rich("footer.credits", richLinks(locale, t("a11y.newTab")))}
    </p>
  );
}

/** The end of a lesson panel: the data's makers first, then the site's. */
export function LessonCredits({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-2">
      <DataCredit locale={locale} />
      <CreditLine locale={locale} coffee={false} />
    </div>
  );
}

export async function SiteFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale });
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-400 sm:px-6">
        <DataCredit locale={locale} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CreditLine locale={locale} coffee />
          <p className="text-xs text-zinc-400">
            <Link href={localePath(locale, "/about")} className={LINK_CLASS}>
              {t("footer.about")}
            </Link>
            <span aria-hidden="true"> · </span>
            <SiteLink href={LINKS.license} newTab={t("a11y.newTab")}>
              {t("footer.code")}
            </SiteLink>
          </p>
        </div>
      </div>
    </footer>
  );
}
