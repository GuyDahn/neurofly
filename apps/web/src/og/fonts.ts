import type { Locale } from "../i18n/locales.js";
import { shapingFont, type ShapingFont } from "./text.js";

/**
 * Noto for every script on the share cards: the locale's own script first,
 * then Noto Sans for Latin names, digits, and punctuation inside it.
 */
const SCRIPT_FAMILY: Partial<Record<Locale, string>> = {
  he: "Noto Sans Hebrew",
  ar: "Noto Sans Arabic",
  hi: "Noto Sans Devanagari",
  ja: "Noto Sans JP",
  ko: "Noto Sans KR",
  "zh-CN": "Noto Sans SC",
};

const LATIN = "Noto Sans";

export function familiesFor(locale: Locale): string[] {
  const script = SCRIPT_FAMILY[locale];
  return script ? [script, LATIN] : [LATIN];
}

/** An old Safari user agent makes Google Fonts answer with TrueType, which HarfBuzz reads. */
const TRUETYPE_AGENT =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

const fetched = new Map<string, Promise<ArrayBuffer>>();

/**
 * One font, cut down to the characters in `text` (Google keeps the shaping
 * tables for them). The build runs this once per language and weight.
 */
function googleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  const key = `${family}|${weight}|${text}`;
  let pending = fetched.get(key);
  if (!pending) {
    pending = (async () => {
      const query = `family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
      const css = await fetchText(`https://fonts.googleapis.com/css2?${query}`);
      const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(
        css,
      )?.[1];
      if (!url) throw new Error(`Google Fonts sent no TrueType for ${family}`);
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`${family} download failed: HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    })();
    fetched.set(key, pending);
    pending.catch(() => fetched.delete(key));
  }
  return pending;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": TRUETYPE_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

const parsed = new Map<string, Promise<ShapingFont[]>>();

/**
 * Fonts that can draw `text` in `locale`, in fallback order. Pass every
 * card's text for the language at once, and each card reuses the download.
 */
export function fontsFor(
  locale: Locale,
  weight: number,
  text: string,
): Promise<ShapingFont[]> {
  const chars = [...new Set(text)].sort().join("");
  const key = `${locale}|${weight}|${chars}`;
  let pending = parsed.get(key);
  if (!pending) {
    pending = Promise.all(
      familiesFor(locale).map(async (family) =>
        shapingFont(await googleFont(family, weight, chars)),
      ),
    );
    parsed.set(key, pending);
    pending.catch(() => parsed.delete(key));
  }
  return pending;
}
