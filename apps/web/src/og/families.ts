import type { Locale } from "../i18n/locales.js";

/**
 * Which Noto family draws each language on the share cards: the language's
 * own script first, then Noto Sans for Latin names, digits, and punctuation
 * inside it. Pure, so the font script and the checks can read it too.
 */
export const LATIN_FAMILY = "Noto Sans";

const SCRIPT_FAMILY: Partial<Record<Locale, string>> = {
  he: "Noto Sans Hebrew",
  ar: "Noto Sans Arabic",
  hi: "Noto Sans Devanagari",
  ja: "Noto Sans JP",
  ko: "Noto Sans KR",
  "zh-CN": "Noto Sans SC",
};

/** Titles are semibold; subtitles and labels are regular. */
export const WEIGHTS = [400, 600] as const;
export type Weight = (typeof WEIGHTS)[number];

export function familiesFor(locale: Locale): string[] {
  const script = SCRIPT_FAMILY[locale];
  return script ? [script, LATIN_FAMILY] : [LATIN_FAMILY];
}

export function allFamilies(locales: readonly Locale[]): string[] {
  return [...new Set(locales.flatMap((locale) => familiesFor(locale)))];
}

/** e.g. noto-sans-jp-600.ttf, in apps/web/src/og/fonts. */
export function fontFile(family: string, weight: Weight): string {
  return `${family.toLowerCase().replace(/ /g, "-")}-${weight}.ttf`;
}

/** Messages whose words appear on a share card, and so need glyphs in its fonts. */
export function isShareCardKey(key: string): boolean {
  return (
    (key.startsWith("og.") && key !== "og.alt") ||
    /^lessons\.[^.]+\.(title|summary)$/.test(key)
  );
}
