import {
  LOCALES,
  DEFAULT_LOCALE,
  type Locale,
} from "../apps/web/src/i18n/locales.js";
import {
  catalogLocales,
  checkSource,
  checkTranslation,
  flatten,
  isLive,
  readCatalog,
  readGlossary,
  unreviewedKeys,
  type Issue,
} from "./i18n/catalog.js";
import { shareFontIssues } from "./i18n/share-fonts.js";

/**
 * pnpm i18n:check [--locale he] [--unreviewed]
 *
 * Holds every messages file to English: the same keys, valid ICU with the
 * same placeholders, tags, and plural forms, the glossary's terms, the
 * brand, the numbers, and search-length titles, and makes sure the share
 * images' fonts can draw every character. Fails on any error, so CI never
 * ships a missing or broken string. Drafts that no reviewer has signed off
 * pass, and are listed.
 */

const args = process.argv.slice(2);
const only = args.includes("--locale")
  ? args[args.indexOf("--locale") + 1]
  : null;
const listUnreviewed = args.includes("--unreviewed");

const glossary = readGlossary();
const enCatalog = readCatalog(DEFAULT_LOCALE);
if (!enCatalog) throw new Error("apps/web/messages/en.json is missing");
const en = flatten(enCatalog);

type Row = {
  locale: string;
  keys: number;
  status: string;
  unreviewed: string[];
  issues: Issue[];
};

const rows: Row[] = [];
const onDisk = new Set(catalogLocales());
const locales = only ? [only] : [...new Set([...LOCALES, ...onDisk])];

for (const locale of locales) {
  const catalog = readCatalog(locale);
  if (!catalog) {
    rows.push({
      locale,
      keys: 0,
      status: "missing",
      unreviewed: [],
      issues: [
        {
          level: "error",
          key: "-",
          message: `messages/${locale}.json does not exist`,
        },
      ],
    });
    continue;
  }
  const flat = flatten(catalog);
  const issues =
    locale === DEFAULT_LOCALE
      ? checkSource(en)
      : checkTranslation({
          locale,
          en,
          target: flat,
          meta: catalog._meta,
          glossary,
        });
  if (isLive(locale)) issues.push(...shareFontIssues(locale as Locale, flat));
  const unreviewed = unreviewedKeys(catalog._meta, flat);
  const status =
    locale === DEFAULT_LOCALE
      ? "source"
      : !isLive(locale)
        ? "not live"
        : catalog._meta?.reviewed
          ? "reviewed"
          : "draft";
  rows.push({ locale, keys: flat.size, status, unreviewed, issues });
}

const pad = (value: string | number, width: number) =>
  String(value).padEnd(width);
console.log(
  `${pad("locale", 8)}${pad("keys", 7)}${pad("status", 11)}${pad("unreviewed", 12)}${pad("errors", 8)}warnings`,
);
for (const row of rows) {
  const errors = row.issues.filter((issue) => issue.level === "error").length;
  const warnings = row.issues.length - errors;
  console.log(
    `${pad(row.locale, 8)}${pad(row.keys, 7)}${pad(row.status, 11)}${pad(row.unreviewed.length, 12)}${pad(errors, 8)}${warnings}`,
  );
}

let failed = false;
for (const row of rows) {
  if (row.issues.length === 0) continue;
  console.log(`\n${row.locale}`);
  for (const issue of row.issues) {
    console.log(
      `  ${issue.level === "error" ? "error  " : "warning"} ${issue.key}: ${issue.message}`,
    );
  }
  // A language that is not live yet may be a work in progress.
  if (
    row.issues.some((issue) => issue.level === "error") &&
    isLive(row.locale)
  ) {
    failed = true;
  }
}

if (listUnreviewed) {
  for (const row of rows) {
    if (row.unreviewed.length === 0) continue;
    console.log(`\n${row.locale}: ${row.unreviewed.length} unreviewed`);
    for (const key of row.unreviewed) console.log(`  ${key}`);
  }
}

const notLive = [...onDisk].filter((locale) => !isLive(locale));
if (notLive.length > 0) {
  console.log(
    `\nNot live yet: ${notLive.join(", ")}. Add them to LOCALES in apps/web/src/i18n/locales.ts once they pass.`,
  );
}

process.exitCode = failed ? 1 : 0;
