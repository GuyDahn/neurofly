import { detectLocale } from "./detect.js";
import {
  canonicalLocale,
  DEFAULT_LOCALE,
  isFallbackLocale,
  isLocale,
  localePath,
} from "./locales.js";

/** Lesson 1 lived at / before the landing page, and its share links still point there. */
const FIRST_LESSON = "/modules/smell-memory";

export type RouteDecision =
  | { kind: "next" }
  | {
      kind: "redirect";
      status: 307 | 308;
      pathname: string;
      /** Only the language-picking redirect at / varies by visitor. */
      vary?: string;
    }
  | { kind: "rewrite"; pathname: string; noindex: true };

/**
 * What the middleware does with a page request. Pure, so tests can walk every
 * rule without a server:
 *
 * - `/` picks a language (a saved choice, then Accept-Language, then the
 *   visitor's country, then English) and redirects once.
 * - A URL that names a live language is served as is, never redirected.
 * - A language spelled in the wrong case moves to the right spelling.
 * - A language without a translation serves the English page at its own URL.
 * - Anything else is a page from before the site had languages, which was
 *   English, so it moves to /en for good.
 */
export function routeRequest({
  pathname,
  hasReplay,
  cookie,
  acceptLanguage,
  country,
}: {
  pathname: string;
  /** The URL carries a share link's ?r=. */
  hasReplay: boolean;
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): RouteDecision {
  if (pathname === "/") {
    const locale = detectLocale({ cookie, acceptLanguage, country });
    return {
      kind: "redirect",
      status: 307,
      pathname: localePath(locale, hasReplay ? FIRST_LESSON : "/"),
      vary: "Accept-Language",
    };
  }
  const [, first = "", ...rest] = pathname.split("/");
  if (isLocale(first)) return { kind: "next" };
  const named = canonicalLocale(first);
  if (named && named !== first) {
    return {
      kind: "redirect",
      status: 308,
      pathname: ["", named, ...rest].join("/"),
    };
  }
  if (named && isFallbackLocale(named)) {
    return {
      kind: "rewrite",
      pathname: localePath(DEFAULT_LOCALE, `/${rest.join("/")}`),
      noindex: true,
    };
  }
  return {
    kind: "redirect",
    status: 308,
    pathname: localePath(DEFAULT_LOCALE, pathname),
  };
}
