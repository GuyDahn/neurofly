/**
 * Every language WiredMind is served in, and every language it knows how to
 * name. Nothing here may import Next.js or next-intl: the middleware, the
 * scripts, and the tests all read this file.
 */

/** Fully translated and indexed. `pnpm i18n:check` fails if any key is missing. */
export const LOCALES = [
  "en",
  "he",
  "ar",
  "es",
  "fr",
  "de",
  "pt-BR",
  "ru",
  "zh-CN",
  "ja",
  "ko",
  "hi",
  "it",
  "tr",
  "pl",
  "nl",
  "id",
  "vi",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Remembers a language picked from the language menu, and nothing else. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Languages without a translation yet. `/fa/about` serves the English page
 * with a note asking for help, never an empty page and never a redirect.
 * Move a locale into LOCALES once its messages file passes `pnpm i18n:check`.
 */
export const FALLBACK_LOCALES = [
  "fa",
  "ur",
  "uk",
  "bn",
  "th",
  "ms",
  "fil",
  "sw",
  "ta",
  "te",
  "mr",
  "sv",
  "da",
  "nb",
  "fi",
  "cs",
  "el",
  "ro",
  "hu",
  "ca",
  "zh-TW",
] as const;

export type FallbackLocale = (typeof FALLBACK_LOCALES)[number];

/** Written right to left. Includes languages that are not live yet, so they flip the day they are. */
export const RTL_LOCALES: ReadonlySet<string> = new Set([
  "he",
  "ar",
  "fa",
  "ur",
]);

/** Each language's own name for itself, for the language menu. */
export const ENDONYMS: Record<Locale, string> = {
  en: "English",
  he: "עברית",
  ar: "العربية",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  "pt-BR": "Português (Brasil)",
  ru: "Русский",
  "zh-CN": "简体中文",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  it: "Italiano",
  tr: "Türkçe",
  pl: "Polski",
  nl: "Nederlands",
  id: "Bahasa Indonesia",
  vi: "Tiếng Việt",
};

/** Open Graph wants language_TERRITORY. Facebook spells Arabic ar_AR. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  he: "he_IL",
  ar: "ar_AR",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  "pt-BR": "pt_BR",
  ru: "ru_RU",
  "zh-CN": "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
  hi: "hi_IN",
  it: "it_IT",
  tr: "tr_TR",
  pl: "pl_PL",
  nl: "nl_NL",
  id: "id_ID",
  vi: "vi_VN",
};

/**
 * Where a visitor with no usable Accept-Language most likely reads. Only
 * countries with one clear classroom language are listed; the rest get
 * English rather than a guess (India, Belgium, Canada, Taiwan, ...).
 */
export const COUNTRY_LOCALES: Readonly<Record<string, Locale>> = {
  IL: "he",
  ...each("ar", "AE BH DZ EG IQ JO KW LB LY MA OM PS QA SA SD SY TN YE MR"),
  ...each(
    "es",
    "ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY PR GQ",
  ),
  ...each("fr", "FR MC SN CI ML BF NE TG BJ GA CG CD MG CM GN HT"),
  ...each("de", "DE AT CH LI"),
  ...each("pt-BR", "BR PT AO MZ"),
  ...each("ru", "RU BY KZ KG"),
  CN: "zh-CN",
  JP: "ja",
  KR: "ko",
  ...each("it", "IT SM VA"),
  TR: "tr",
  PL: "pl",
  ...each("nl", "NL SR"),
  ID: "id",
  VN: "vi",
};

function each(locale: Locale, countries: string): Record<string, Locale> {
  return Object.fromEntries(
    countries.split(" ").map((country) => [country, locale]),
  );
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function isFallbackLocale(value: string): value is FallbackLocale {
  return (FALLBACK_LOCALES as readonly string[]).includes(value);
}

export function direction(locale: string): "rtl" | "ltr" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}

/** The canonical spelling of a locale in a URL, e.g. pt-br -> pt-BR. */
export function canonicalLocale(value: string): Locale | FallbackLocale | null {
  const lower = value.toLowerCase();
  for (const locale of [...LOCALES, ...FALLBACK_LOCALES]) {
    if (locale.toLowerCase() === lower) return locale;
  }
  return null;
}

/** `/he/about` for a page path like `/about`, and `/he` for `/`. */
export function localePath(locale: string, path: string): string {
  if (path === "/" || path === "") return `/${locale}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Splits `/he/about#x` into its locale and page path. The locale may be live
 * or a fallback one; anything else is part of the path.
 */
export function splitLocalePath(pathname: string): {
  locale: Locale | FallbackLocale | null;
  path: string;
} {
  const [, first = "", ...rest] = pathname.split("/");
  const locale = canonicalLocale(first);
  if (!locale) return { locale: null, path: pathname || "/" };
  const path = `/${rest.join("/")}`;
  return { locale, path: path === "/" ? "/" : path.replace(/\/$/, "") };
}
