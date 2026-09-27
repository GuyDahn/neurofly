import * as bidiModule from "bidi-js";
import type { Font } from "harfbuzzjs";

/**
 * Share-image text, shaped by HarfBuzz and drawn as SVG paths.
 *
 * Satori, inside @vercel/og, lays text out with opentype.js, which cannot
 * shape Devanagari (conjuncts break and the ि vowel sign lands after its
 * consonant) and measures Arabic in unjoined forms, so its words drift apart.
 * HarfBuzz is the shaper browsers use; bidi-js orders mixed-direction runs
 * the way the Unicode Bidirectional Algorithm does. Satori then only places
 * the finished drawing as an image.
 */

type HarfBuzz = typeof import("harfbuzzjs");

let loading: Promise<HarfBuzz> | null = null;
function harfbuzz(): Promise<HarfBuzz> {
  loading ??= import("harfbuzzjs");
  return loading;
}

type BidiFactory = typeof import("bidi-js").default;
/** bidi-js is ESM for bundlers and CommonJS for Node; its types describe only the first. */
const bidiFactory: BidiFactory =
  (bidiModule as unknown as { default?: BidiFactory }).default ??
  (bidiModule as unknown as BidiFactory);
const bidi = bidiFactory();

export type ShapingFont = {
  font: Font;
  upem: number;
  ascender: number;
  descender: number;
  has: (codepoint: number) => boolean;
  paths: Map<number, string>;
};

export async function shapingFont(data: ArrayBuffer): Promise<ShapingFont> {
  const hb = await harfbuzz();
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  const extents = font.hExtents();
  const codepoints = new Set(face.collectUnicodes());
  return {
    font,
    upem: face.upem,
    ascender: extents.ascender,
    descender: extents.descender,
    has: (codepoint) => codepoints.has(codepoint),
    paths: new Map(),
  };
}

type Glyph = {
  font: ShapingFont;
  id: number;
  x: number;
  y: number;
  advance: number;
};

/** Combining marks and joiners stay in their base character's font. */
const CLINGS = /[\p{M}‌‍]/u;
/** Spaces and punctuation shared by every script. */
const COMMON = /[\p{Z}\p{P}\p{S}\p{N}]/u;

/** Splits text into runs that one font can draw, falling back font by font. */
function fontRuns(
  text: string,
  fonts: readonly ShapingFont[],
): { start: number; end: number; font: ShapingFont }[] {
  const runs: { start: number; end: number; font: ShapingFont }[] = [];
  let at = 0;
  let previous: ShapingFont | null = null;
  for (const char of text) {
    const codepoint = char.codePointAt(0)!;
    let font: ShapingFont | undefined;
    if (
      previous &&
      (CLINGS.test(char) || (COMMON.test(char) && previous.has(codepoint)))
    ) {
      font = previous;
    } else {
      font = fonts.find((candidate) => candidate.has(codepoint)) ?? fonts[0]!;
    }
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.end = at + char.length;
    else runs.push({ start: at, end: at + char.length, font });
    previous = font;
    at += char.length;
  }
  return runs;
}

/** One line, shaped and in visual order, in font units of `size`. */
async function shapeLine(
  line: string,
  fonts: readonly ShapingFont[],
  rtl: boolean,
  size: number,
): Promise<{ glyphs: Glyph[]; width: number }> {
  const hb = await harfbuzz();
  const { levels } = bidi.getEmbeddingLevels(line, rtl ? "rtl" : "ltr");
  // Logical runs of one bidi level and one font.
  type Run = { start: number; end: number; level: number; font: ShapingFont };
  const runs: Run[] = [];
  let start = 0;
  for (let index = 1; index <= line.length; index++) {
    if (index < line.length && levels[index] === levels[start]) continue;
    for (const piece of fontRuns(line.slice(start, index), fonts)) {
      runs.push({
        start: start + piece.start,
        end: start + piece.end,
        level: levels[start]!,
        font: piece.font,
      });
    }
    start = index;
  }
  // Rule L2: from the highest level down to the lowest odd one, reverse every
  // stretch of runs at that level or above.
  const highest = Math.max(0, ...runs.map((run) => run.level));
  const lowestOdd = Math.min(
    ...runs.map((run) => (run.level % 2 === 1 ? run.level : Infinity)),
  );
  for (let level = highest; level >= lowestOdd && level > 0; level--) {
    for (let index = 0; index < runs.length;) {
      if (runs[index]!.level < level) {
        index += 1;
        continue;
      }
      let end = index;
      while (end < runs.length && runs[end]!.level >= level) end += 1;
      runs.splice(index, end - index, ...runs.slice(index, end).reverse());
      index = end;
    }
  }
  const glyphs: Glyph[] = [];
  let x = 0;
  for (const run of runs) {
    const scale = size / run.font.upem;
    const buffer = new hb.Buffer();
    buffer.addText(line.slice(run.start, run.end));
    buffer.guessSegmentProperties();
    buffer.setDirection(
      run.level % 2 === 1 ? hb.Direction.RTL : hb.Direction.LTR,
    );
    hb.shape(run.font.font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    infos.forEach((info, index) => {
      const position = positions[index]!;
      glyphs.push({
        font: run.font,
        id: info.codepoint,
        x: x + position.xOffset * scale,
        y: position.yOffset * scale,
        advance: position.xAdvance * scale,
      });
      x += position.xAdvance * scale;
    });
  }
  return { glyphs, width: x };
}

/** Closing marks that may not start a line, and opening marks that may not end one. */
const NO_START = /^[\s、。，．！？：；」』）】〉》”’)\]},.!?:;…]/u;
const NO_END = /[「『（【〈《“‘([{]$/u;

/**
 * Pieces of text a line may break between: after spaces, and in Chinese and
 * Japanese also between words, which Intl.Segmenter finds with a dictionary.
 */
export function breakPieces(text: string, locale: string): string[] {
  const unspaced = /^(zh|ja)\b/.test(locale);
  const segments = [
    ...new Intl.Segmenter(locale, { granularity: "word" }).segment(text),
  ].map((part) => part.segment);
  const pieces: string[] = [];
  let current = "";
  segments.forEach((segment, index) => {
    current += segment;
    const next = segments[index + 1];
    if (next === undefined) return;
    const afterSpace = /\s$/.test(segment) && !/^\s/.test(next);
    const betweenWords =
      unspaced &&
      !/\s/.test(segment) &&
      !NO_START.test(next) &&
      !NO_END.test(segment);
    if (afterSpace || betweenWords) {
      pieces.push(current);
      current = "";
    }
  });
  if (current) pieces.push(current);
  return pieces;
}

export type TextImage = {
  /** An SVG document with the text as filled paths. */
  svg: string;
  width: number;
  height: number;
  lines: number;
};

/**
 * Lays out and draws a paragraph, starting at `size` and shrinking until it
 * fits in `maxLines` lines of `maxWidth`. Right-to-left text is right aligned.
 */
export async function textImage({
  text,
  fonts,
  size,
  minSize = size,
  lineHeight,
  maxWidth,
  maxLines,
  color,
  rtl,
  locale,
}: {
  text: string;
  fonts: readonly ShapingFont[];
  size: number;
  minSize?: number;
  /** As a multiple of the font size. */
  lineHeight: number;
  maxWidth: number;
  maxLines: number;
  color: string;
  rtl: boolean;
  locale: string;
}): Promise<TextImage> {
  const pieces = breakPieces(text.trim(), locale);
  let fitSize = size;
  let laid: { glyphs: Glyph[]; width: number }[] = [];
  for (;;) {
    laid = [];
    let line = "";
    for (const piece of pieces) {
      const candidate = line + piece;
      if (
        !line ||
        (await shapeLine(candidate.trimEnd(), fonts, rtl, fitSize)).width <=
          maxWidth
      ) {
        line = candidate;
      } else {
        laid.push(await shapeLine(line.trimEnd(), fonts, rtl, fitSize));
        line = piece;
      }
    }
    if (line) laid.push(await shapeLine(line.trimEnd(), fonts, rtl, fitSize));
    const fits =
      laid.length <= maxLines && laid.every((row) => row.width <= maxWidth);
    if (fits || fitSize <= minSize) break;
    fitSize = Math.max(minSize, fitSize - 2);
  }
  const primary = fonts[0]!;
  const scale = fitSize / primary.upem;
  const step = fitSize * lineHeight;
  const ink = (primary.ascender - primary.descender) * scale;
  const baseline = (step - ink) / 2 + primary.ascender * scale;
  const width = Math.ceil(Math.max(0, ...laid.map((row) => row.width)));
  const height = Math.ceil(step * laid.length);
  const paths: string[] = [];
  laid.forEach((row, index) => {
    const left = rtl ? width - row.width : 0;
    const y = index * step + baseline;
    for (const glyph of row.glyphs) {
      let d = glyph.font.paths.get(glyph.id);
      if (d === undefined) {
        d = glyph.font.font.glyphToPath(glyph.id);
        glyph.font.paths.set(glyph.id, d);
      }
      if (!d) continue;
      const k = fitSize / glyph.font.upem;
      paths.push(
        `<path transform="translate(${(left + glyph.x).toFixed(2)} ${(y - glyph.y).toFixed(2)}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" d="${d}"/>`,
      );
    }
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="${color}">${paths.join("")}</svg>`;
  return { svg, width, height, lines: laid.length };
}
