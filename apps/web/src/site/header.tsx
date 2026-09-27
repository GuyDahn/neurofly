import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  ENDONYMS,
  localePath,
  type Locale,
} from "../i18n/locales.js";
import { LanguageMenu } from "./language-menu.js";
import { LINKS, SITE_NAME } from "./site.js";
import { ThemeToggle } from "./theme-toggle.js";
import { TranslateNotice } from "./translate-notice.js";

const NAV_LINK =
  "rounded-md px-1 py-1 text-fg-muted transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** The spike mark from the favicon: a trace that goes blue, red, then yellow, like the escape cascade. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}>
      <defs>
        <linearGradient id="wiredmind-mark" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="0.55" stopColor="#F87171" />
          <stop offset="1" stopColor="#FACC15" />
        </linearGradient>
      </defs>
      {/* The mark's own badge: fixed dark, like the favicon, regardless of site theme. */}
      <rect width="32" height="32" rx="8" fill="#18181b" />
      <path
        d="M4.5 18.5h6.5l2.6-11 3.6 17 2.4-9.5h7.9"
        fill="none"
        stroke="url(#wiredmind-mark)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The note that asks readers of an untranslated language for help. English pages only. */
export async function SiteTranslateNotice({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  if (locale !== DEFAULT_LOCALE) return null;
  const t = await getTranslations({ locale, namespace: "translate" });
  return (
    <TranslateNotice
      notice={t("notice", { language: "{language}" })}
      cta={t("cta")}
      dismiss={t("dismiss")}
      href={LINKS.translate}
      className={className}
    />
  );
}

export async function SiteHeader({
  locale,
  path,
}: {
  locale: Locale;
  /** This page without its language, for the language menu. */
  path: string;
}) {
  const t = await getTranslations({ locale });
  const home = localePath(locale, "/");
  return (
    <>
      <SiteTranslateNotice locale={locale} />
      <header className="border-b border-border">
        <a
          href="#main"
          className="sr-only rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-fg focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50"
        >
          {t("a11y.skip")}
        </a>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={home}
            aria-label={t("nav.home")}
            className="flex shrink-0 items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Mark className="size-7" />
            <span lang="en" translate="no">
              {SITE_NAME}
            </span>
          </Link>
          <nav
            aria-label={t("nav.label")}
            className="flex min-w-0 items-center gap-2 text-sm sm:gap-5"
          >
            <Link href={`${home}#lessons`} className={NAV_LINK}>
              {t("nav.lessons")}
            </Link>
            <Link
              href={`${home}#teachers`}
              className={`${NAV_LINK} hidden sm:inline`}
            >
              {t("nav.teachers")}
            </Link>
            <Link href={localePath(locale, "/about")} className={NAV_LINK}>
              {t("nav.about")}
            </Link>
            <ThemeToggle
              light={t("nav.themeLight")}
              dark={t("nav.themeDark")}
            />
            <LanguageMenu
              current={locale}
              path={path}
              label={t("language.button", { language: ENDONYMS[locale] })}
              menuLabel={t("language.menu")}
            />
          </nav>
        </div>
      </header>
    </>
  );
}
