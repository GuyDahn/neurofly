import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectLocale,
  matchLanguages,
  parseAcceptLanguage,
} from "../apps/web/src/i18n/detect.js";
import {
  canonicalLocale,
  direction,
  ENDONYMS,
  FALLBACK_LOCALES,
  LOCALES,
  localePath,
  OG_LOCALES,
  splitLocalePath,
} from "../apps/web/src/i18n/locales.js";
import { pick, type MessageTree } from "../apps/web/src/i18n/messages.js";
import { routeRequest } from "../apps/web/src/i18n/route.js";
import { breakPieces } from "../apps/web/src/og/text.js";
import { fill } from "../apps/web/src/site/text.js";
import { LESSONS } from "../apps/web/src/viewer/modules.js";
import {
  checkTranslation,
  displayWidth,
  englishNumbers,
  flatten,
  numbersIn,
  readCatalog,
  readGlossary,
  readStyleGuide,
  shapeOf,
  unreviewedKeys,
} from "../scripts/i18n/catalog.js";
import {
  shareCardChars,
  shareFontIssues,
} from "../scripts/i18n/share-fonts.js";

const en = flatten(readCatalog("en")!);
const glossary = readGlossary();

describe("languages", () => {
  it("serves the 18 launch languages and names each in its own script", () => {
    assert.deepEqual(
      [...LOCALES],
      [
        "en",
        "he",
        "ar",
        "es",
        "fr",
        "de",
        "pt-BR",
        "ru",
        "zh-CN",
        "ja",
        "ko",
        "hi",
        "it",
        "tr",
        "pl",
        "nl",
        "id",
        "vi",
      ],
    );
    for (const locale of LOCALES) {
      assert.ok(ENDONYMS[locale], locale);
      assert.match(OG_LOCALES[locale], /^[a-z]{2}_[A-Z]{2}$/);
    }
    for (const locale of FALLBACK_LOCALES) {
      assert.ok(!(LOCALES as readonly string[]).includes(locale), locale);
    }
  });

  it("writes Hebrew, Arabic, Persian, and Urdu right to left", () => {
    for (const locale of ["he", "ar", "fa", "ur"]) {
      assert.equal(direction(locale), "rtl");
    }
    for (const locale of ["en", "ja", "hi", "zh-CN"]) {
      assert.equal(direction(locale), "ltr");
    }
  });

  it("reads and writes language prefixes", () => {
    assert.equal(localePath("he", "/"), "/he");
    assert.equal(localePath("he", "/about"), "/he/about");
    assert.equal(canonicalLocale("pt-br"), "pt-BR");
    assert.equal(canonicalLocale("ZH-cn"), "zh-CN");
    assert.equal(canonicalLocale("about"), null);
    assert.deepEqual(splitLocalePath("/he/modules/escape"), {
      locale: "he",
      path: "/modules/escape",
    });
    assert.deepEqual(splitLocalePath("/fa"), { locale: "fa", path: "/" });
    assert.deepEqual(splitLocalePath("/about"), {
      locale: null,
      path: "/about",
    });
  });
});

describe("language detection at /", () => {
  it("ranks Accept-Language by q, then by order, and skips junk", () => {
    assert.deepEqual(
      parseAcceptLanguage("fr-CA;q=0.8, he-IL, *, en;q=0.8, xx-!!, de;q=0"),
      ["he-IL", "fr-CA", "en"],
    );
    assert.deepEqual(parseAcceptLanguage(null), []);
  });

  it("matches the same language across regions and scripts", () => {
    assert.equal(matchLanguages(["pt-PT"]), "pt-BR");
    assert.equal(matchLanguages(["zh-TW"]), "zh-CN");
    assert.equal(matchLanguages(["es-419"]), "es");
    assert.equal(matchLanguages(["iw"]), "he");
    assert.equal(matchLanguages(["en-GB"]), "en");
  });

  it("never hands a reader a different language, except Indonesian for Malay", () => {
    assert.equal(matchLanguages(["uk"]), null);
    assert.equal(matchLanguages(["be"]), null);
    assert.equal(matchLanguages(["sv", "de"]), "de");
    assert.equal(matchLanguages(["ms"]), "id");
  });

  it("prefers a picked language, then the browser, then the country, then English", () => {
    assert.equal(
      detectLocale({ cookie: "ar", acceptLanguage: "he", country: "JP" }),
      "ar",
    );
    assert.equal(
      detectLocale({ cookie: "xx", acceptLanguage: "he", country: "JP" }),
      "he",
    );
    assert.equal(detectLocale({ acceptLanguage: "sv", country: "JP" }), "ja");
    assert.equal(detectLocale({ acceptLanguage: "sv", country: "IN" }), "en");
    assert.equal(detectLocale({}), "en");
  });
});

describe("routing", () => {
  const route = (
    pathname: string,
    extra: Partial<Parameters<typeof routeRequest>[0]> = {},
  ) => routeRequest({ pathname, hasReplay: false, ...extra });

  it("guesses a language only at /, once, and says it varies", () => {
    assert.deepEqual(route("/", { acceptLanguage: "he-IL,he;q=0.9" }), {
      kind: "redirect",
      status: 307,
      pathname: "/he",
      vary: "Accept-Language",
    });
    assert.deepEqual(route("/", { hasReplay: true, acceptLanguage: "de" }), {
      kind: "redirect",
      status: 307,
      pathname: "/de/modules/smell-memory",
      vary: "Accept-Language",
    });
  });

  it("serves a URL that names its language as is", () => {
    for (const locale of LOCALES) {
      assert.deepEqual(route(`/${locale}/about`, { acceptLanguage: "ja" }), {
        kind: "next",
      });
    }
  });

  it("fixes the spelling of a language and keeps the rest", () => {
    assert.deepEqual(route("/pt-br/modules/escape"), {
      kind: "redirect",
      status: 308,
      pathname: "/pt-BR/modules/escape",
    });
  });

  it("serves the English page, out of search, where a translation is missing", () => {
    assert.deepEqual(route("/fa/about"), {
      kind: "rewrite",
      pathname: "/en/about",
      noindex: true,
    });
    assert.deepEqual(route("/zh-TW"), {
      kind: "rewrite",
      pathname: "/en",
      noindex: true,
    });
  });

  it("moves pages from before the site had languages to English for good", () => {
    assert.deepEqual(route("/modules/escape", { acceptLanguage: "he" }), {
      kind: "redirect",
      status: 308,
      pathname: "/en/modules/escape",
    });
  });
});

describe("messages", () => {
  it("sends a page only the branches it asks for, as copies", () => {
    const tree: MessageTree = {
      viewer: { a: "A" },
      lessons: { one: { title: "One", body: "x" }, two: { title: "Two" } },
    };
    const picked = pick(tree, ["viewer", "lessons.one", "lessons.two.title"]);
    assert.deepEqual(picked, {
      viewer: { a: "A" },
      lessons: { one: { title: "One", body: "x" }, two: { title: "Two" } },
    });
    (picked.viewer as MessageTree).a = "changed";
    assert.equal((tree.viewer as MessageTree).a, "A");
    assert.throws(() => pick(tree, ["nope"]), /No messages at nope/);
  });

  it("has English for every lesson step, answer, and circuit control", () => {
    for (const { lesson, module } of LESSONS) {
      const base = `lessons.${lesson.id}`;
      for (const key of [
        "title",
        "summary",
        "description",
        "check.question",
        "freePlay.title",
        "freePlay.text",
      ]) {
        assert.ok(en.has(`${base}.${key}`), `${base}.${key}`);
      }
      for (const step of lesson.steps) {
        assert.ok(en.has(`${base}.steps.${step.id}.text`), step.id);
        assert.ok(en.has(`${base}.steps.${step.id}.result`), step.id);
      }
      for (const choice of lesson.check.choices) {
        assert.ok(en.has(`${base}.check.choices.${choice.id}.text`), choice.id);
        assert.ok(
          en.has(`${base}.check.choices.${choice.id}.feedback`),
          choice.id,
        );
      }
      const circuit = `circuits.${module.circuit}`;
      for (const group of module.groups) {
        assert.ok(
          en.has(`${circuit}.groups.${group.colorGroup}`),
          group.colorGroup,
        );
      }
      for (const control of module.stimuli) {
        assert.ok(en.has(`${circuit}.stimulate.${control.colorGroup}`));
      }
      for (const control of module.silence) {
        assert.ok(en.has(`${circuit}.silence.${control.colorGroup}`));
      }
    }
  });
});

describe("time units", () => {
  // The hero's clock, its per-group stat rows, its caption, a lesson's
  // "watching the brain" progress line, and a replay press's timestamp:
  // every message that stamps a formatted duration into running text.
  const TIME_KEYS = [
    "landing.loop.clock",
    "landing.loop.firstSpike",
    "landing.loop.caption",
    "viewer.lesson.puffClock",
    "viewer.replay.tick",
  ];
  const sample = {
    ms: "50.8",
    cells: "2 cells",
    spanMs: 64,
    slowdown: 100,
    elapsed: "123",
    total: "200",
    name: "Giant fiber",
  };

  it("never leaves a bare Latin ms/MS in the hero or a lesson, in he or ar", () => {
    for (const locale of ["he", "ar"]) {
      const flat = flatten(readCatalog(locale)!);
      for (const key of TIME_KEYS) {
        const template = flat.get(key);
        assert.ok(template, `${locale} is missing ${key}`);
        const text = fill(template!, sample);
        assert.doesNotMatch(
          text,
          /\bms\b/i,
          `${locale} ${key} keeps a bare Latin unit: ${text}`,
        );
      }
    }
  });

  it("reads the given example exactly, in Hebrew", () => {
    const clock = flatten(readCatalog("he")!).get("landing.loop.clock")!;
    assert.equal(fill(clock, { ms: "50.8" }), "50.8 מ״ש של זמן זבוב");
  });
});

describe("translation checks", () => {
  const source = new Map([
    ["a.plural", "{count, plural, one {# cell} other {# cells}}"],
    ["a.link", "Data from the <malecns>MaleCNS v1.0</malecns> connectome."],
    ["a.brand", "WiredMind has 3 lessons of 10 minutes."],
    [
      "a.term",
      "Silence the <term>Kenyon cells</term> <gloss>(the sorters)</gloss>.",
    ],
    ["landing.loop.clock", "{ms} ms of fly time"],
  ]);
  const good = new Map([
    ["a.plural", "{count, plural, one {# תא} two {# תאים} other {# תאים}}"],
    ["a.link", "נתונים מהקונקטום <malecns>MaleCNS v1.0</malecns>."],
    ["a.brand", "ב־WiredMind יש 3 שיעורים של 10 דקות."],
    ["a.term", "השתיקו את <term>תאי קניון</term> <gloss>(הממיינים)</gloss>."],
    ["landing.loop.clock", "{ms} ms של זמן זבוב"],
  ]);
  const meta = { locale: "he", reviewed: false };
  const check = (target: Map<string, string>) =>
    checkTranslation({ locale: "he", en: source, target, meta, glossary })
      .filter((issue) => issue.level === "error")
      .map((issue) => `${issue.key}: ${issue.message}`);

  it("passes a faithful translation", () => {
    assert.deepEqual(check(good), []);
  });

  it("catches what a translation must not lose", () => {
    const bad = new Map(good);
    bad.set("a.plural", "{count, plural, one {# תא} other {# תאים}}");
    bad.set("a.link", "נתונים מהקונקטום MaleCNS v1.0.");
    bad.set("a.brand", "בווירדמיינד יש 3 שיעורים של עשר דקות.");
    bad.set(
      "a.term",
      "השתיקו את <term>התאים</term> <gloss>(הממיינים)</gloss>.",
    );
    bad.set("landing.loop.clock", "{ms, number} ms של זמן זבוב");
    bad.set("a.extra", "?");
    const errors = check(bad).join("\n");
    assert.match(errors, /a\.plural: plural \{count\} lacks two/);
    assert.match(errors, /a\.link: has <malecns> 0 times/);
    assert.match(errors, /a\.brand: must say WiredMind 1 times/);
    assert.match(errors, /a\.brand: lost the number 10/);
    assert.match(
      errors,
      /a\.term: must use the glossary term for “Kenyon cell”/,
    );
    assert.match(
      errors,
      /landing\.loop\.clock: must hold plain \{placeholders\} only/,
    );
    assert.match(errors, /a\.extra: not in English/);
  });

  it("flags untranslated strings and missing keys", () => {
    const lazy = new Map(good);
    lazy.set("a.term", source.get("a.term")!);
    lazy.delete("landing.loop.clock");
    const errors = check(lazy).join("\n");
    assert.match(errors, /a\.term: not translated/);
    assert.match(errors, /landing\.loop\.clock: missing/);
  });

  it("reads numbers however a language groups and points them", () => {
    assert.deepEqual(
      englishNumbers("3,000 to 4,500 at 0.275 mV, 1–2 periods"),
      [3000, 4500, 0.275, 1, 2],
    );
    const has = (text: string, value: number) =>
      numbersIn(text).some((meanings) => meanings.includes(value));
    assert.ok(has("3.000 bis 4.500", 3000));
    assert.ok(has("0,275 mV", 0.275));
    assert.ok(has("1 861 neurones", 1861));
    assert.ok(has("١٨٦١ خلية", 1861));
    assert.ok(has("४० Hz", 40));
  });

  it("parses ICU shape and counts wide characters twice", () => {
    const shape = shapeOf("<b>{n, plural, one {# x} other {# xs}}</b> {name}");
    assert.deepEqual([...shape.args.keys()], ["n", "name"]);
    assert.deepEqual([...shape.tags], [["b", 1]]);
    assert.equal(shape.simple, false);
    assert.equal(displayWidth("ハエ · WiredMind"), 16);
  });

  it("lists every key of an unreviewed draft, and only the flagged ones after review", () => {
    assert.equal(
      unreviewedKeys({ locale: "he", reviewed: false }, en).length,
      en.size,
    );
    assert.deepEqual(
      unreviewedKeys(
        { locale: "he", reviewed: true, unreviewedKeys: ["nav.about", "gone"] },
        en,
      ),
      ["nav.about"],
    );
  });
});

describe("glossary and style guide", () => {
  const live = LOCALES.filter((locale) => locale !== "en");

  it("gives every scientific term an accepted translation that its own pattern accepts", () => {
    for (const [name, entry] of Object.entries(glossary.terms)) {
      assert.ok(new RegExp(entry.match, "iu").test(name), name);
      for (const locale of live) {
        const local = entry[locale];
        assert.ok(local && typeof local === "object", `${name} ${locale}`);
        assert.ok(
          new RegExp(local.match, "iu").test(local.term),
          `${name} ${locale}: ${local.term} does not match ${local.match}`,
        );
      }
    }
    assert.equal(glossary.brand, "WiredMind");
  });

  it("tells each language how to talk to students", () => {
    const style = readStyleGuide();
    for (const locale of live) assert.ok(style.locales[locale], locale);
  });
});

describe("share image text", () => {
  it("breaks after spaces, and between words in Chinese and Japanese", () => {
    assert.deepEqual(breakPieces("The 30-millisecond escape", "en"), [
      "The ",
      "30-millisecond ",
      "escape",
    ]);
    const ja = breakPieces("ハエはどうやってにおいを覚えるのか", "ja");
    assert.ok(ja.length > 3, ja.join("|"));
    assert.equal(ja.join(""), "ハエはどうやってにおいを覚えるのか");
    const zh = breakPieces("苍蝇如何记住一种气味，", "zh-CN");
    assert.ok(!zh.some((piece) => piece.startsWith("，")), zh.join("|"));
  });

  it("reads every branch's words and the digits a number can take", () => {
    const chars = shareCardChars(
      new Map([
        [
          "og.lessonLabel",
          "{number, plural, one {Lesson #} other {Lessons #}}",
        ],
        ["og.alt", "Ω {title}"],
        ["landing.title", "Ж"],
      ]),
      "ar-u-nu-arab",
    );
    for (const char of "Lesons 3٣") assert.ok(chars.has(char), char);
    for (const char of "{}#ΩЖ") assert.ok(!chars.has(char), char);
    assert.equal(chars.get("s"), "og.lessonLabel");
  });

  it("has fonts that draw every card in every language", () => {
    for (const locale of LOCALES) {
      const flat = flatten(readCatalog(locale)!);
      assert.deepEqual(shareFontIssues(locale, flat), [], locale);
    }
  });

  it("names the message that needs a character the fonts lack", () => {
    const ja = flatten(readCatalog("ja")!);
    ja.set("lessons.escape.title", `${ja.get("lessons.escape.title")}鬱`);
    const issues = shareFontIssues("ja", ja);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.key, "lessons.escape.title");
    assert.match(issues[0]!.message, /鬱 \(U\+9B31\).*pnpm og:fonts/);
  });
});
