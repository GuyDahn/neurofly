import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  parse,
  TYPE,
  type MessageFormatElement,
} from "@formatjs/icu-messageformat-parser";
import { DEFAULT_LOCALE, LOCALES } from "../../apps/web/src/i18n/locales.js";
import type { MessagesMeta } from "../../apps/web/src/i18n/messages.js";
import { LINK_TAGS, TEXT_TAGS } from "../../apps/web/src/site/links.js";
import { fill } from "../../apps/web/src/site/text.js";

/**
 * The messages files and the rules every language is held to. Shared by
 * `pnpm i18n:check`, `pnpm i18n:draft`, and the tests.
 */

export const WEB = new URL("../../apps/web/", import.meta.url);
export const MESSAGES = new URL("messages/", WEB);

/** Messages filled in by client code on every frame, which may hold plain {placeholders} only. */
export const SIMPLE_KEYS: ReadonlySet<string> = new Set([
  "landing.loop.clock",
  "translate.notice",
  "meta.lessonTitle",
]);

/** Search result limits, counting a Chinese, Japanese, or Korean character as two. */
export const TITLE_WIDTH = 60;
export const DESCRIPTION_WIDTH = 155;

export type Tree = { [key: string]: string | Tree };
export type Catalog = { _meta?: MessagesMeta } & Tree;
export type Flat = Map<string, string>;

export type Glossary = {
  brand: string;
  keep: string[];
  terms: Record<
    string,
    { note: string; match: string } & Record<
      string,
      { term: string; match: string } | string
    >
  >;
};

export type StyleGuide = { shared: string[]; locales: Record<string, string> };

export function readJson<T>(url: URL): T {
  return JSON.parse(readFileSync(url, "utf8")) as T;
}

export function catalogUrl(locale: string): URL {
  return new URL(`${locale}.json`, MESSAGES);
}

export function readCatalog(locale: string): Catalog | null {
  const url = catalogUrl(locale);
  return existsSync(url) ? readJson<Catalog>(url) : null;
}

/** Every messages file on disk, live or not. */
export function catalogLocales(): string[] {
  return readdirSync(MESSAGES)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

export function readGlossary(): Glossary {
  return readJson<Glossary>(new URL("i18n/glossary.json", WEB));
}

export function readStyleGuide(): StyleGuide {
  return readJson<StyleGuide>(new URL("i18n/style-guide.json", WEB));
}

/** `{ a: { b: "x" } }` as `a.b -> x`, in file order, without the review notes. */
export function flatten(tree: Tree, prefix = ""): Flat {
  const flat: Flat = new Map();
  for (const [key, value] of Object.entries(tree)) {
    if (!prefix && key === "_meta") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") flat.set(path, value);
    else if (value && typeof value === "object") {
      for (const [inner, text] of flatten(value, path)) flat.set(inner, text);
    } else {
      flat.set(path, String(value));
    }
  }
  return flat;
}

/** Builds a tree in English's key order from flat entries, skipping keys English lacks. */
export function unflatten(order: Iterable<string>, flat: Flat): Tree {
  const tree: Tree = {};
  for (const path of order) {
    const value = flat.get(path);
    if (value === undefined) continue;
    const keys = path.split(".");
    let into = tree;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) into[key] = value;
      else {
        const next = into[key];
        into = typeof next === "object" ? next : (into[key] = {});
      }
    });
  }
  return tree;
}

/** The parts of an ICU message that must survive translation. */
export type Shape = {
  /** Argument name to how it is used: argument, number, plural, select, ... */
  args: Map<string, string>;
  /** Tag name to how many times it appears. */
  tags: Map<string, number>;
  /** The categories of every plural, in order. */
  plurals: { arg: string; options: string[] }[];
  /** Only literal text and plain {placeholders}. */
  simple: boolean;
};

const KIND: Record<number, string> = {
  [TYPE.argument]: "argument",
  [TYPE.number]: "number",
  [TYPE.date]: "date",
  [TYPE.time]: "time",
  [TYPE.select]: "select",
  [TYPE.plural]: "plural",
};

export function shapeOf(message: string): Shape {
  const shape: Shape = {
    args: new Map(),
    tags: new Map(),
    plurals: [],
    simple: true,
  };
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal) continue;
      if (element.type !== TYPE.argument) shape.simple = false;
      if (element.type === TYPE.tag) {
        shape.tags.set(element.value, (shape.tags.get(element.value) ?? 0) + 1);
        walk(element.children);
        continue;
      }
      if (element.type === TYPE.pound) continue;
      shape.args.set(element.value, KIND[element.type] ?? "argument");
      if (element.type === TYPE.plural || element.type === TYPE.select) {
        if (element.type === TYPE.plural) {
          shape.plurals.push({
            arg: element.value,
            options: Object.keys(element.options),
          });
        }
        for (const option of Object.values(element.options)) walk(option.value);
      }
    }
  };
  walk(parse(message, { requiresOtherClause: true }));
  return shape;
}

/** Letters, numbers, and marks only: the text a reader sees, minus tags and placeholders. */
export function visibleText(message: string): string {
  return message.replace(/<\/?[a-z]+>/g, "").replace(/\{[^{}]*\}/g, "");
}

const DIGIT_BLOCKS = [0x0660, 0x06f0, 0x0966, 0xff10];

function asciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹०-९０-９]/g, (digit) => {
    const code = digit.charCodeAt(0);
    const block = DIGIT_BLOCKS.find(
      (start) => code >= start && code <= start + 9,
    )!;
    return String(code - block);
  });
}

/**
 * The numbers a message states. A translation may group and point them its
 * own way (3 000, 3.000, 0,275), so each one yields every value it can mean.
 */
export function numbersIn(message: string): number[][] {
  const text = asciiDigits(visibleText(message));
  const found: number[][] = [];
  for (const match of text.matchAll(/\d+(?:[.,٫٬   ' ]\d+)*/g)) {
    const raw = match[0];
    const groups = raw.split(/[.,٫٬   ' ]/);
    const meanings = [Number(groups.join(""))];
    const last = /[.,٫](\d+)$/.exec(raw);
    if (last && groups.length > 1) {
      meanings.push(Number(`${groups.slice(0, -1).join("")}.${last[1]}`));
    }
    found.push(meanings);
  }
  return found;
}

/** English's numbers, read the English way: commas group, points are decimal. */
export function englishNumbers(message: string): number[] {
  const text = visibleText(message);
  return [...text.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)].map((match) =>
    Number(match[0].replace(/,/g, "")),
  );
}

/** Characters as a reader sees them, counting Chinese, Japanese, and Korean ones as two. */
export function displayWidth(text: string): number {
  let width = 0;
  for (const { segment } of new Intl.Segmenter("en", {
    granularity: "grapheme",
  }).segment(text)) {
    width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/u.test(segment) ? 2 : 1;
  }
  return width;
}

export type Issue = {
  level: "error" | "warning";
  key: string;
  message: string;
};

function termFor(
  entry: Glossary["terms"][string],
  locale: string,
): { term: string; match: string } | null {
  const value = entry[locale];
  return value && typeof value === "object" ? value : null;
}

/** Words that would need translating: not the brand, kept names, numbers, or units. */
function translatableWords(message: string, glossary: Glossary): number {
  let text = visibleText(message).replaceAll(glossary.brand, " ");
  for (const keep of glossary.keep) text = text.replaceAll(keep, " ");
  return (text.match(/\p{L}{2,}/gu) ?? []).filter(
    (word) => !/^(ms|mV|Hz)$/.test(word),
  ).length;
}

/** Search titles and descriptions, filled in the way the pages fill them. */
export function searchSnippets(
  flat: Flat,
): { key: string; text: string; limit: number }[] {
  const snippets: { key: string; text: string; limit: number }[] = [];
  for (const key of [
    "meta.home.title",
    "meta.about.title",
    "meta.notFoundTitle",
  ]) {
    const text = flat.get(key);
    if (text !== undefined) snippets.push({ key, text, limit: TITLE_WIDTH });
  }
  const template = flat.get("meta.lessonTitle");
  for (const [key, text] of flat) {
    if (/^lessons\.[^.]+\.title$/.test(key) && template !== undefined) {
      snippets.push({
        key: `meta.lessonTitle (${key})`,
        text: fill(template, { title: text }),
        limit: TITLE_WIDTH,
      });
    }
    if (
      key === "meta.home.description" ||
      key === "meta.about.description" ||
      /^lessons\.[^.]+\.description$/.test(key)
    ) {
      snippets.push({ key, text, limit: DESCRIPTION_WIDTH });
    }
  }
  return snippets;
}

/** Rules that hold for the English source itself. */
export function checkSource(en: Flat): Issue[] {
  const issues: Issue[] = [];
  const known = new Set<string>([...Object.keys(LINK_TAGS), ...TEXT_TAGS]);
  for (const [key, message] of en) {
    let shape: Shape;
    try {
      shape = shapeOf(message);
    } catch (error) {
      issues.push({ level: "error", key, message: `ICU: ${String(error)}` });
      continue;
    }
    for (const tag of shape.tags.keys()) {
      if (!known.has(tag)) {
        issues.push({ level: "error", key, message: `unknown tag <${tag}>` });
      }
    }
    if (SIMPLE_KEYS.has(key) && !shape.simple) {
      issues.push({
        level: "error",
        key,
        message: "must hold plain {placeholders} only",
      });
    }
  }
  for (const snippet of searchSnippets(en)) {
    const width = displayWidth(snippet.text);
    if (width > snippet.limit) {
      issues.push({
        level: "error",
        key: snippet.key,
        message: `${width} characters, over the ${snippet.limit} search results show`,
      });
    }
  }
  return issues;
}

/**
 * Every rule a translation must meet against English: the same keys, valid
 * ICU with the same placeholders and tags, every plural form the language
 * has, the glossary's terms, the brand, the same numbers, and search-length
 * titles.
 */
export function checkTranslation({
  locale,
  en,
  target,
  meta,
  glossary,
}: {
  locale: string;
  en: Flat;
  target: Flat;
  meta: MessagesMeta | undefined;
  glossary: Glossary;
}): Issue[] {
  const issues: Issue[] = [];
  const error = (key: string, message: string) =>
    issues.push({ level: "error", key, message });
  const warn = (key: string, message: string) =>
    issues.push({ level: "warning", key, message });
  const categories = new Intl.PluralRules(locale).resolvedOptions()
    .pluralCategories as string[];
  const same = new Set(meta?.sameAsSource ?? []);

  if (!meta) error("_meta", "missing the _meta review notes");
  else {
    if (meta.locale !== locale) error("_meta.locale", `says ${meta.locale}`);
    if (typeof meta.reviewed !== "boolean") {
      error("_meta.reviewed", "must be true or false");
    }
    for (const key of [...(meta.unreviewedKeys ?? []), ...same]) {
      if (!en.has(key))
        error("_meta", `lists ${key}, which English does not have`);
    }
  }

  for (const key of target.keys()) {
    if (!en.has(key)) error(key, "not in English; remove it");
  }

  for (const [key, source] of en) {
    const text = target.get(key);
    if (text === undefined) {
      error(key, "missing");
      continue;
    }
    if (text.trim() === "") {
      error(key, "empty");
      continue;
    }
    let want: Shape;
    let got: Shape;
    try {
      want = shapeOf(source);
      got = shapeOf(text);
    } catch (problem) {
      error(key, `ICU: ${String(problem)}`);
      continue;
    }
    for (const [name, kind] of want.args) {
      const found = got.args.get(name);
      if (!found) error(key, `lost the placeholder {${name}}`);
      else if (
        kind === "plural" &&
        found !== "plural" &&
        categories.some((category) => category !== "other")
      ) {
        error(key, `{${name}} needs a plural in ${locale}`);
      }
    }
    for (const name of got.args.keys()) {
      if (!want.args.has(name))
        error(key, `adds a placeholder {${name}} English does not have`);
    }
    const tags = new Set([...want.tags.keys(), ...got.tags.keys()]);
    for (const tag of tags) {
      const expected = want.tags.get(tag) ?? 0;
      const actual = got.tags.get(tag) ?? 0;
      if (expected !== actual) {
        error(key, `has <${tag}> ${actual} times, English has it ${expected}`);
      }
    }
    for (const plural of got.plurals) {
      const missing = categories.filter(
        (category) => !plural.options.includes(category),
      );
      if (missing.length > 0) {
        error(
          key,
          `plural {${plural.arg}} lacks ${missing.join(", ")} for ${locale}`,
        );
      }
      const extra = plural.options.filter(
        (option) => !option.startsWith("=") && !categories.includes(option),
      );
      if (extra.length > 0) {
        warn(
          key,
          `plural {${plural.arg}} has ${extra.join(", ")}, which ${locale} never uses`,
        );
      }
    }
    if (SIMPLE_KEYS.has(key) && !got.simple) {
      error(key, "must hold plain {placeholders} only, no plural or tags");
    }

    const brand = (message: string) => message.split(glossary.brand).length - 1;
    if (brand(source) !== brand(text)) {
      error(
        key,
        `must say ${glossary.brand} ${brand(source)} times, untranslated`,
      );
    }
    for (const keep of glossary.keep) {
      if (source.includes(keep) && !text.includes(keep)) {
        error(key, `must keep “${keep}” as is`);
      }
    }
    for (const [name, entry] of Object.entries(glossary.terms)) {
      if (!new RegExp(entry.match, "iu").test(visibleText(source))) continue;
      const accepted = termFor(entry, locale);
      if (!accepted) continue;
      if (!new RegExp(accepted.match, "iu").test(visibleText(text))) {
        error(
          key,
          `must use the glossary term for “${name}”: ${accepted.term}`,
        );
      }
    }
    const theirs = numbersIn(text);
    for (const number of englishNumbers(source)) {
      const found = theirs.some((meanings) =>
        meanings.some((value) => Math.abs(value - number) < 1e-9),
      );
      if (!found) error(key, `lost the number ${number}`);
    }
    if (
      locale !== DEFAULT_LOCALE &&
      text === source &&
      !same.has(key) &&
      translatableWords(source, glossary) >= 2
    ) {
      error(key, "not translated (same as English)");
    }
  }

  for (const snippet of searchSnippets(target)) {
    const width = displayWidth(snippet.text);
    if (width > snippet.limit) {
      error(
        snippet.key,
        `${width} characters, over the ${snippet.limit} search results show`,
      );
    }
  }
  return issues;
}

/** Keys a reviewer has not signed off yet. */
export function unreviewedKeys(
  meta: MessagesMeta | undefined,
  flat: Flat,
): string[] {
  if (!meta?.reviewed) return [...flat.keys()];
  return (meta.unreviewedKeys ?? []).filter((key) => flat.has(key));
}

export function isLive(locale: string): boolean {
  return (LOCALES as readonly string[]).includes(locale);
}
