import { existsSync, readFileSync } from "node:fs";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { LOCALES, type Locale } from "../../apps/web/src/i18n/locales.js";
import {
  familiesFor,
  fontFile,
  isShareCardKey,
  LATIN_FAMILY,
  WEIGHTS,
} from "../../apps/web/src/og/families.js";
import { WEB, type Flat, type Issue } from "./catalog.js";

/**
 * The share images' fonts, which live in the repo cut down to the characters
 * the cards use. Shared by `pnpm og:fonts`, which fetches them, and
 * `pnpm i18n:check`, which fails when a message needs a character they lack.
 */

export const FONTS = new URL("src/og/fonts/", WEB);

/** What Noto Sans is asked for; each language's own script comes from its own font. */
const LATIN_FAMILY_SCRIPTS =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]/u;

/** Characters HarfBuzz draws as nothing, so no font needs them. */
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cc}]/u;

/** The digits a number takes in `locale`, plus the ASCII ones plain placeholders print. */
function digitsOf(locale: string): string {
  const format = new Intl.NumberFormat(locale, { useGrouping: false });
  let digits = "0123456789";
  for (let digit = 0; digit < 10; digit++) digits += format.format(digit);
  return digits;
}

/**
 * Every character `locale`'s share cards can show, each with the first
 * message that shows it: the words of every plural and select branch, and
 * the digits the lesson numbers may take.
 */
export function shareCardChars(
  flat: Flat,
  locale: string,
): Map<string, string> {
  const chars = new Map<string, string>();
  const digits = digitsOf(locale);
  for (const [key, message] of flat) {
    if (!isShareCardKey(key)) continue;
    const add = (text: string) => {
      for (const char of text) if (!chars.has(char)) chars.set(char, key);
    };
    const walk = (elements: MessageFormatElement[]) => {
      for (const element of elements) {
        if (element.type === TYPE.literal) add(element.value);
        else if (
          element.type === TYPE.argument ||
          element.type === TYPE.number ||
          element.type === TYPE.pound
        ) {
          add(digits);
        } else if (element.type === TYPE.tag) walk(element.children);
        else if (element.type === TYPE.plural || element.type === TYPE.select) {
          for (const option of Object.values(element.options)) {
            walk(option.value);
          }
        }
      }
    };
    walk(parse(message, { requiresOtherClause: true }));
  }
  return chars;
}

/** The characters to cut `family` down to: what every language drawn with it shows. */
export function familyText(
  family: string,
  catalogs: ReadonlyMap<Locale, Flat>,
): string {
  const chars = new Set<string>();
  for (const locale of LOCALES) {
    if (!familiesFor(locale).includes(family)) continue;
    const flat = catalogs.get(locale);
    if (!flat) continue;
    for (const char of shareCardChars(flat, locale).keys()) {
      if (INVISIBLE.test(char)) continue;
      if (family === LATIN_FAMILY && !LATIN_FAMILY_SCRIPTS.test(char)) continue;
      chars.add(char);
    }
  }
  return [...chars].sort().join("");
}

/** The code points a TrueType font maps to a glyph, read from its cmap table. */
export function fontCodepoints(bytes: Uint8Array): Set<number> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cmap = -1;
  for (let table = 0; table < view.getUint16(4); table++) {
    const record = 12 + table * 16;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    if (tag === "cmap") cmap = view.getUint32(record + 8);
  }
  if (cmap < 0) throw new Error("The font has no cmap table");
  const found = new Set<number>();
  for (let index = 0; index < view.getUint16(cmap + 2); index++) {
    const record = cmap + 4 + index * 8;
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const unicode =
      platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    const at = cmap + view.getUint32(record + 4);
    const format = view.getUint16(at);
    if (format === 4) {
      // Segments of consecutive code points, each mapped by a delta or a glyph list.
      const segments = view.getUint16(at + 6) / 2;
      const ends = at + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        const end = view.getUint16(ends + segment * 2);
        const start = view.getUint16(starts + segment * 2);
        const delta = view.getUint16(deltas + segment * 2);
        const offsetAt = offsets + segment * 2;
        const offset = view.getUint16(offsetAt);
        for (let code = start; code <= end && code !== 0xffff; code++) {
          let glyph = code;
          if (offset !== 0) {
            glyph = view.getUint16(offsetAt + offset + (code - start) * 2);
            if (glyph === 0) continue;
          }
          if ((glyph + delta) & 0xffff) found.add(code);
        }
      }
    } else if (format === 12) {
      // Groups of consecutive code points mapped to consecutive glyphs.
      for (let group = 0; group < view.getUint32(at + 12); group++) {
        const record = at + 16 + group * 12;
        const start = view.getUint32(record);
        const end = view.getUint32(record + 4);
        const glyph = view.getUint32(record + 8);
        for (let code = start; code <= end; code++) {
          if (glyph + (code - start) !== 0) found.add(code);
        }
      }
    }
  }
  return found;
}

const coverage = new Map<string, Set<number> | null>();

function committedFont(file: string): Set<number> | null {
  if (!coverage.has(file)) {
    const url = new URL(file, FONTS);
    coverage.set(
      file,
      existsSync(url) ? fontCodepoints(readFileSync(url)) : null,
    );
  }
  return coverage.get(file)!;
}

/** Drop what was read from disk, after `pnpm og:fonts` rewrites the fonts. */
export function forgetFonts(): void {
  coverage.clear();
}

const REFRESH =
  "Run pnpm og:fonts, then commit apps/web/src/og/fonts, so its share images can draw it.";

/** Errors for every character `locale`'s share cards need that its committed fonts cannot draw. */
export function shareFontIssues(locale: Locale, flat: Flat): Issue[] {
  const issues: Issue[] = [];
  const lacking = new Map<string, Set<string>>();
  for (const weight of WEIGHTS) {
    const fonts = familiesFor(locale).map((family) => {
      const file = fontFile(family, weight);
      const codepoints = committedFont(file);
      if (!codepoints) {
        issues.push({
          level: "error",
          key: "-",
          message: `apps/web/src/og/fonts/${file} is missing. ${REFRESH}`,
        });
      }
      return codepoints;
    });
    if (fonts.includes(null)) continue;
    for (const [char, key] of shareCardChars(flat, locale)) {
      if (INVISIBLE.test(char)) continue;
      const codepoint = char.codePointAt(0)!;
      if (fonts.some((codepoints) => codepoints!.has(codepoint))) continue;
      const chars = lacking.get(key) ?? new Set();
      chars.add(char);
      lacking.set(key, chars);
    }
  }
  for (const [key, chars] of lacking) {
    const list = [...chars]
      .map(
        (char) =>
          `${char} (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`,
      )
      .join(", ");
    issues.push({
      level: "error",
      key,
      message: `the share image's fonts have no ${list}. ${REFRESH}`,
    });
  }
  return issues;
}
