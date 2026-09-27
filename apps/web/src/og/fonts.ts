import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Locale } from "../i18n/locales.js";
import { familiesFor, fontFile, type Weight } from "./families.js";
import { shapingFont, type ShapingFont } from "./text.js";

/**
 * The share cards' Noto fonts live in the repo, cut down to the characters
 * the cards use, so the build draws every language without the network.
 * `pnpm og:fonts` refreshes them; `pnpm i18n:check` fails when a message
 * needs a character they lack.
 */
const FONT_DIR = path.join(process.cwd(), "src", "og", "fonts");

const loaded = new Map<string, Promise<ShapingFont>>();

function font(family: string, weight: Weight): Promise<ShapingFont> {
  const file = fontFile(family, weight);
  let pending = loaded.get(file);
  if (!pending) {
    pending = readFile(path.join(FONT_DIR, file)).then(shapingFont);
    loaded.set(file, pending);
  }
  return pending;
}

/** Fonts that draw `locale`'s share cards at `weight`, in fallback order. */
export function fontsFor(
  locale: Locale,
  weight: Weight,
): Promise<ShapingFont[]> {
  return Promise.all(familiesFor(locale).map((family) => font(family, weight)));
}
