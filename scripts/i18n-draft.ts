import { writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_LOCALE } from "../apps/web/src/i18n/locales.js";
import type { MessagesMeta } from "../apps/web/src/i18n/messages.js";
import {
  catalogUrl,
  checkTranslation,
  flatten,
  readCatalog,
  readGlossary,
  readStyleGuide,
  SIMPLE_KEYS,
  unflatten,
  type Flat,
  type Glossary,
  type StyleGuide,
} from "./i18n/catalog.js";

/**
 * pnpm i18n:draft <locale> [--all] [--keys a.b,c.d] [--model id] [--dry-run] [--print-prompt]
 *
 * Drafts the missing (or, with --all, every) message of one language with
 * Claude, from English, the glossary, and the style guide, then checks each
 * draft with the same rules as `pnpm i18n:check` and asks once more for any
 * that fail. Drafts are marked unreviewed until a speaker signs them off
 * (see CONTRIBUTING.md#translations).
 */

const MODEL = "claude-opus-5";
/** Keys per request: small enough that one bad answer costs little. */
const BATCH = 40;
/** Interface words before the lessons that use them, so the lessons name buttons the way the buttons read. */
const ORDER = [
  "viewer",
  "circuits",
  "nav",
  "a11y",
  "language",
  "translate",
  "footer",
  "support",
  "errors",
  "meta",
  "og",
  "manifest",
  "jsonLd",
  "credits",
  "landing",
  "about",
  "lessons",
];
/** Words other messages quote, handed to every later batch. */
const TERMINOLOGY =
  /^(viewer\.controls\.(stimulate|silence|reset)|viewer\.lesson\.(cue\w+|freePlay|next)|viewer\.toolbar\.share|circuits\.[^.]+\.groups\.[^.]+|lessons\.[^.]+\.freePlay\.title)$/;

type Options = {
  locale: string;
  all: boolean;
  keys: string[] | null;
  model: string;
  dryRun: boolean;
  printPrompt: boolean;
};

function options(argv: string[]): Options {
  const locale = argv.find((arg) => !arg.startsWith("--"));
  const value = (flag: string) =>
    argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;
  if (!locale || locale === DEFAULT_LOCALE) {
    throw new Error(
      "Usage: pnpm i18n:draft <locale> [--all] [--keys a.b,c.d] [--model id] [--dry-run] [--print-prompt]",
    );
  }
  return {
    locale,
    all: argv.includes("--all"),
    keys: value("--keys")?.split(",") ?? null,
    model: value("--model") ?? MODEL,
    dryRun: argv.includes("--dry-run"),
    printPrompt: argv.includes("--print-prompt"),
  };
}

function languageName(locale: string): string {
  return (
    new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale
  );
}

/** The translator's standing instructions for one language. Identical for every batch, so it caches. */
export function systemPrompt(
  locale: string,
  glossary: Glossary,
  style: StyleGuide,
): string {
  const categories = new Intl.PluralRules(locale).resolvedOptions()
    .pluralCategories as string[];
  const terms = Object.entries(glossary.terms)
    .map(([english, entry]) => {
      const local = entry[locale];
      return local && typeof local === "object"
        ? `- ${english} → ${local.term} (${entry.note})`
        : null;
    })
    .filter(Boolean)
    .join("\n");
  return [
    `You translate the copy of ${glossary.brand}, a free website of neuroscience lessons built on the real wiring diagram of a fruit fly, from English into ${languageName(locale)} (${locale}). A native speaker reviews your draft before it reaches students.`,
    "",
    "How the copy should read:",
    ...style.shared.map((rule) => `- ${rule}`),
    `- ${style.locales[locale] ?? "Write natural, standard language a secondary-school student reads easily."}`,
    "",
    "ICU MessageFormat, which every value is written in:",
    "- Copy every {placeholder} exactly as it is. Only the words inside plural and select branches get translated.",
    `- A plural, {n, plural, ...}, must list exactly these categories for ${locale}: ${categories.join(", ")}. Use # where the number goes.`,
    "- Keep every <tag>...</tag> pair with the same name and the same number of times, around the words that carry that meaning in your sentence.",
    "- An ASCII apostrophe right before {, }, or # escapes it in ICU. Use the typographic ’ in running text if your language needs apostrophes.",
    `- These messages are filled in by code with plain text and must keep plain {placeholders} only, no plural or tags: ${[...SIMPLE_KEYS].join(", ")}.`,
    "",
    "Glossary: use these accepted terms, inflected as your grammar needs:",
    terms,
    "",
    `Never translate ${glossary.brand} or these names: ${glossary.keep.join(", ")}.`,
    "",
    "Answer with a JSON object that has exactly the keys you are given, each value the translated message.",
  ].join("\n");
}

/** What a translator should know about one key. */
function noteFor(key: string): string | null {
  if (/^meta\.(home|about)\.title$|^meta\.notFoundTitle$/.test(key)) {
    return "search result title, at most 60 characters";
  }
  if (key === "meta.lessonTitle") {
    return "search result title pattern; with a lesson title filled in it must stay within 60 characters";
  }
  if (/\.description$/.test(key) && /^(meta|lessons)\./.test(key)) {
    return "search result description, at most 155 characters";
  }
  if (/^lessons\.[^.]+\.(steps|check|freePlay)\./.test(key)) {
    return "lesson copy for students; keep <term>/<gloss> markup, glosses three words or fewer";
  }
  if (/^viewer\.controls\.|^viewer\.lesson\.cue/.test(key)) {
    return "button or label on the lesson controls; keep it short";
  }
  if (key === "landing.loop.clock") return "redrawn on every animation frame";
  if (key.startsWith("og.")) return "printed on the share image; keep it short";
  if (key.startsWith("jsonLd.")) return "structured data for search engines";
  return null;
}

export type Batch = { keys: string[]; namespace: string };

export function batches(keys: string[]): Batch[] {
  const byNamespace = new Map<string, string[]>();
  for (const key of keys) {
    const namespace = key.split(".")[0]!;
    byNamespace.set(namespace, [...(byNamespace.get(namespace) ?? []), key]);
  }
  const namespaces = [...byNamespace.keys()].sort(
    (a, b) =>
      (ORDER.indexOf(a) + 1 || ORDER.length + 1) -
      (ORDER.indexOf(b) + 1 || ORDER.length + 1),
  );
  const out: Batch[] = [];
  for (const namespace of namespaces) {
    const group = byNamespace.get(namespace)!;
    for (let start = 0; start < group.length; start += BATCH) {
      out.push({ namespace, keys: group.slice(start, start + BATCH) });
    }
  }
  return out;
}

export function batchPrompt(
  batch: Batch,
  en: Flat,
  terminology: Flat,
  fixes: Map<string, string[]> = new Map(),
): string {
  const source = Object.fromEntries(
    batch.keys.map((key) => [key, en.get(key)]),
  );
  const notes = batch.keys
    .map((key) => {
      const note = noteFor(key);
      return note ? `- ${key}: ${note}` : null;
    })
    .filter(Boolean);
  const chosen = [...terminology].filter(([key]) => !batch.keys.includes(key));
  const problems = [...fixes].map(
    ([key, list]) => `- ${key}: ${list.join("; ")}`,
  );
  return [
    "Translate these messages:",
    JSON.stringify(source, null, 2),
    ...(notes.length ? ["", "Notes:", ...notes] : []),
    ...(chosen.length
      ? [
          "",
          "Words you already chose elsewhere; reuse them exactly:",
          JSON.stringify(Object.fromEntries(chosen), null, 2),
        ]
      : []),
    ...(problems.length
      ? [
          "",
          "Your last draft of these failed the checks. Fix exactly this:",
          ...problems,
        ]
      : []),
  ].join("\n");
}

function schemaFor(keys: string[]) {
  return {
    type: "object",
    properties: Object.fromEntries(
      keys.map((key) => [key, { type: "string" }]),
    ),
    required: keys,
    additionalProperties: false,
  };
}

async function draftBatch(
  client: Anthropic,
  model: string,
  system: string,
  prompt: string,
  keys: string[],
): Promise<Map<string, string>> {
  const message = await client.beta.messages
    .stream({
      model,
      max_tokens: 64_000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: schemaFor(keys) },
      },
      // A refused request runs again on the model Anthropic picks for its
      // refusal category, instead of failing the batch.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error(
      `the model declined (${message.stop_details?.category ?? "no category"})`,
    );
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("the answer was cut off at max_tokens");
  }
  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const answer = JSON.parse(text) as Record<string, unknown>;
  const out = new Map<string, string>();
  for (const key of keys) {
    const value = answer[key];
    if (typeof value === "string") out.set(key, value);
  }
  return out;
}

/** Which keys need a draft: missing, empty, or still the English, unless asked for more. */
export function keysToDraft(
  en: Flat,
  target: Flat,
  opts: Pick<Options, "all" | "keys">,
): string[] {
  if (opts.keys) {
    for (const key of opts.keys) {
      if (!en.has(key)) throw new Error(`English has no key ${key}`);
    }
    return opts.keys;
  }
  return [...en.keys()].filter((key) => {
    if (opts.all) return true;
    const text = target.get(key);
    return text === undefined || text.trim() === "" || text === en.get(key);
  });
}

async function main() {
  const opts = options(process.argv.slice(2));
  const glossary = readGlossary();
  const style = readStyleGuide();
  const enCatalog = readCatalog(DEFAULT_LOCALE)!;
  const en = flatten(enCatalog);
  const existing = readCatalog(opts.locale);
  const target = existing ? flatten(existing) : new Map<string, string>();
  const todo = keysToDraft(en, target, opts);
  const plan = batches(todo);
  const system = systemPrompt(opts.locale, glossary, style);

  if (opts.printPrompt) {
    console.log(system);
    const terminology = new Map(
      [...en].filter(([key]) => TERMINOLOGY.test(key)),
    );
    for (const batch of plan) {
      console.log(`\n--- ${batch.namespace} (${batch.keys.length} keys)\n`);
      console.log(
        batchPrompt(
          batch,
          en,
          new Map([...terminology].filter(([key]) => target.has(key))),
        ),
      );
    }
    return;
  }
  console.log(
    `${opts.locale}: ${todo.length} of ${en.size} keys to draft in ${plan.length} requests with ${opts.model}.`,
  );
  if (todo.length === 0 || opts.dryRun) return;

  const client = new Anthropic();
  const drafted = new Map(target);
  const done: string[] = [];
  for (const [index, batch] of plan.entries()) {
    const terminology = new Map(
      [...drafted].filter(
        ([key]) =>
          (TERMINOLOGY.test(key) && !todo.includes(key)) ||
          (TERMINOLOGY.test(key) && done.includes(key)),
      ),
    );
    process.stdout.write(
      `  ${index + 1}/${plan.length} ${batch.namespace} (${batch.keys.length})… `,
    );
    let answer = await draftBatch(
      client,
      opts.model,
      system,
      batchPrompt(batch, en, terminology),
      batch.keys,
    );
    // Check the draft the way i18n:check will, and ask once more for what fails.
    const failing = new Map<string, string[]>();
    const check = (values: Map<string, string>) => {
      failing.clear();
      const scope = new Map(batch.keys.map((key) => [key, en.get(key)!]));
      const issues = checkTranslation({
        locale: opts.locale,
        en: scope,
        target: values,
        meta: { locale: opts.locale, reviewed: false },
        glossary,
      }).filter((issue) => issue.level === "error");
      for (const issue of issues) {
        const key = issue.key.replace(
          /^meta\.lessonTitle \((.+)\)$/,
          "meta.lessonTitle",
        );
        failing.set(key, [...(failing.get(key) ?? []), issue.message]);
      }
    };
    check(answer);
    if (failing.size > 0) {
      const retryKeys = [...failing.keys()].filter((key) =>
        batch.keys.includes(key),
      );
      const fixed = await draftBatch(
        client,
        opts.model,
        system,
        batchPrompt({ ...batch, keys: retryKeys }, en, terminology, failing),
        retryKeys,
      );
      answer = new Map([...answer, ...fixed]);
      check(answer);
    }
    for (const [key, value] of answer) {
      drafted.set(key, value);
      done.push(key);
    }
    console.log(
      failing.size
        ? `${failing.size} still failing: ${[...failing.keys()].join(", ")}`
        : "ok",
    );
  }

  const previous = existing?._meta;
  const meta: MessagesMeta = {
    locale: opts.locale,
    reviewed: previous?.reviewed === true,
    model: opts.model,
    draftedAt: new Date().toISOString().slice(0, 10),
  };
  if (meta.reviewed) {
    meta.unreviewedKeys = [
      ...new Set([...(previous?.unreviewedKeys ?? []), ...done]),
    ];
  }
  if (previous?.sameAsSource?.length) meta.sameAsSource = previous.sameAsSource;
  const file = { _meta: meta, ...unflatten(en.keys(), drafted) };
  writeFileSync(catalogUrl(opts.locale), `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `Wrote apps/web/messages/${opts.locale}.json. Run pnpm i18n:check --locale ${opts.locale}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error(
        "No Anthropic credentials. Set ANTHROPIC_API_KEY or run `ant auth login`, then try again.",
      );
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error(
        "Rate limited by the Anthropic API. Wait a minute and run the same command; finished keys are kept only when the run completes.",
      );
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  });
}
