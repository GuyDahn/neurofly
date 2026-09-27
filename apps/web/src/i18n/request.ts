// Only types from next-intl's root: its values include the client provider,
// and importing one would ship the translation runtime to every page.
import type { IntlError } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales.js";
import { withoutMeta, type Messages } from "./messages.js";

type Catalog = { default: Messages & { _meta?: unknown } };

/**
 * One import per language, spelled out: a template like
 * `import(\`./\${locale}.json\`)` makes webpack build a context module,
 * and those broke static generation now and then. Adding a language to
 * LOCALES without a line here is a type error.
 */
const CATALOGS: Record<Locale, () => Promise<Catalog>> = {
  en: () => import("../../messages/en.json"),
  he: () => import("../../messages/he.json"),
  ar: () => import("../../messages/ar.json"),
  es: () => import("../../messages/es.json"),
  fr: () => import("../../messages/fr.json"),
  de: () => import("../../messages/de.json"),
  "pt-BR": () => import("../../messages/pt-BR.json"),
  ru: () => import("../../messages/ru.json"),
  "zh-CN": () => import("../../messages/zh-CN.json"),
  ja: () => import("../../messages/ja.json"),
  ko: () => import("../../messages/ko.json"),
  hi: () => import("../../messages/hi.json"),
  it: () => import("../../messages/it.json"),
  tr: () => import("../../messages/tr.json"),
  pl: () => import("../../messages/pl.json"),
  nl: () => import("../../messages/nl.json"),
  id: () => import("../../messages/id.json"),
  vi: () => import("../../messages/vi.json"),
};

/** A missing or broken message fails the build instead of shipping a key path. */
const STRICT =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PHASE === "phase-production-build";

const FATAL: ReadonlySet<string> = new Set([
  "MISSING_MESSAGE",
  "INSUFFICIENT_PATH",
  "INVALID_MESSAGE",
  "FORMATTING_ERROR",
]);

export function onIntlError(error: IntlError) {
  if (STRICT && FATAL.has(error.code)) throw error;
  console.error(error);
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const file = await CATALOGS[locale]();
  return withoutMeta(file.default);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    locale,
    messages: await loadMessages(locale),
    // Nothing on the site formats dates, but next-intl warns without one.
    timeZone: "UTC",
    onError: onIntlError,
  };
});
