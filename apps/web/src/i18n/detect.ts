import { match } from "@formatjs/intl-localematcher";
import {
  COUNTRY_LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  type Locale,
} from "./locales.js";

export { LOCALE_COOKIE } from "./locales.js";

/**
 * Close relatives a reader can take instead of their own language. Any other
 * match across languages is refused: CLDR would hand Ukrainian readers
 * Russian, and English is the better default there.
 */
const NEIGHBORS: Readonly<Record<string, Locale>> = { ms: "id" };

/** Language tags from an Accept-Language header, most wanted first. */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  const ranked: { tag: string; q: number; at: number }[] = [];
  header.split(",").forEach((part, at) => {
    const [range = "", ...params] = part.trim().split(";");
    const tag = range.trim();
    if (!tag || tag === "*") return;
    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key === "q") q = Number(value);
    }
    if (!Number.isFinite(q) || q <= 0) return;
    try {
      const [canonical] = Intl.getCanonicalLocales(tag);
      if (canonical) ranked.push({ tag: canonical, q, at });
    } catch {
      // Not a language tag.
    }
  });
  return ranked.sort((a, b) => b.q - a.q || a.at - b.at).map(({ tag }) => tag);
}

/** The first requested language WiredMind is written in, if any. */
export function matchLanguages(requested: readonly string[]): Locale | null {
  for (const requestedTag of requested) {
    let tag: string;
    try {
      tag = Intl.getCanonicalLocales(requestedTag)[0] ?? requestedTag;
    } catch {
      continue;
    }
    const found = match([tag], LOCALES, "und", { algorithm: "best fit" });
    if (!isLocale(found)) continue;
    const wanted = tag.split("-")[0]!.toLowerCase();
    const got = found.split("-")[0]!.toLowerCase();
    if (wanted === got || NEIGHBORS[wanted] === found) return found;
  }
  return null;
}

/**
 * The language for a visitor at `/`: the one they picked before, else the
 * best Accept-Language match, else their country's classroom language, else
 * English.
 */
export function detectLocale({
  cookie,
  acceptLanguage,
  country,
}: {
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): Locale {
  if (cookie && isLocale(cookie)) return cookie;
  const fromHeader = matchLanguages(
    parseAcceptLanguage(acceptLanguage ?? null),
  );
  if (fromHeader) return fromHeader;
  const fromCountry = country ? COUNTRY_LOCALES[country.toUpperCase()] : null;
  return fromCountry ?? DEFAULT_LOCALE;
}
