import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { LOCALES, type Locale } from "../apps/web/src/i18n/locales.js";
import { allFamilies, fontFile, WEIGHTS } from "../apps/web/src/og/families.js";
import { flatten, readCatalog, type Flat } from "./i18n/catalog.js";
import {
  familyText,
  FONTS,
  fontCodepoints,
  forgetFonts,
  shareFontIssues,
} from "./i18n/share-fonts.js";

/**
 * pnpm og:fonts
 *
 * Fetches the share images' Noto fonts from Google Fonts, each cut down to
 * the characters the cards show in every language that uses it, into
 * apps/web/src/og/fonts. The build reads them from there, so it never waits
 * on the network. Run it when `pnpm i18n:check` says a card needs a
 * character the fonts lack, and commit what it writes.
 */

/** An old Safari user agent makes Google Fonts answer with TrueType, which HarfBuzz reads. */
const TRUETYPE_AGENT =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";

async function get(url: string, headers: Record<string, string> = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(`${url.slice(0, 80)}… failed: ${String(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
}

/** One font, cut down to `text`; Google keeps the shaping tables those characters need. */
async function download(
  family: string,
  weight: number,
  text: string,
): Promise<Uint8Array> {
  const query = `family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (
    await get(`https://fonts.googleapis.com/css2?${query}`, {
      "User-Agent": TRUETYPE_AGENT,
    })
  ).text();
  const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(
    css,
  )?.[1];
  if (!url) throw new Error(`Google Fonts sent no TrueType for ${family}`);
  return new Uint8Array(await (await get(url)).arrayBuffer());
}

const catalogs = new Map<Locale, Flat>();
for (const locale of LOCALES) {
  const catalog = readCatalog(locale);
  if (catalog) catalogs.set(locale, flatten(catalog));
}

mkdirSync(FONTS, { recursive: true });
const written = new Set<string>();
for (const family of allFamilies(LOCALES)) {
  const text = familyText(family, catalogs);
  for (const weight of WEIGHTS) {
    const bytes = await download(family, weight, text);
    const file = fontFile(family, weight);
    writeFileSync(new URL(file, FONTS), bytes);
    written.add(file);
    const glyphs = fontCodepoints(bytes).size;
    console.log(
      `${file.padEnd(32)}${String(glyphs).padStart(5)} characters ${String(Math.round(bytes.byteLength / 1024)).padStart(5)} KB`,
    );
  }
}

for (const file of readdirSync(FONTS)) {
  if (file.endsWith(".ttf") && !written.has(file)) {
    rmSync(new URL(file, FONTS));
    console.log(`${file.padEnd(32)}removed`);
  }
}

forgetFonts();
let failed = false;
for (const [locale, flat] of catalogs) {
  for (const issue of shareFontIssues(locale, flat)) {
    console.error(`${locale} ${issue.key}: ${issue.message}`);
    failed = true;
  }
}
if (failed) {
  console.error(
    "\nNoto has no glyph for those characters. Reword the message, or give the language a font that does.",
  );
  process.exitCode = 1;
}
