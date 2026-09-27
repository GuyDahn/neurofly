import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CASCADE_SPAN_MS,
  encodeCascade,
  fadeAt,
  FADE_MS,
  FLY_MS_PER_WALL_MS,
  flyMsAt,
  LEAD_MS,
  LOOP_MS,
  readCascade,
  wallMsAt,
  type CascadeInput,
} from "../apps/web/src/site/cascade.js";
import {
  buildScene,
  dotsAt,
  FLASH_MS,
  flashAt,
  stillMoment,
} from "../apps/web/src/site/cascade-scene.js";
import { readFileSync } from "node:fs";
import { LOCALES } from "../apps/web/src/i18n/locales.js";
import { cascadeSvg } from "../apps/web/src/site/cascade-svg.js";
import {
  homeJsonLd,
  jsonLdScript,
  lessonJsonLd,
  pageJsonLd,
} from "../apps/web/src/site/json-ld.js";
import { LINK_TAGS } from "../apps/web/src/site/links.js";
import {
  languageAlternates,
  pageMetadata,
} from "../apps/web/src/site/page-meta.js";
import {
  AUTHOR,
  COFFEE_URL,
  LINKS,
  SITE_URL,
} from "../apps/web/src/site/site.js";
import {
  localeSitemapXml,
  SITEMAP_PAGES,
  sitemapIndexXml,
} from "../apps/web/src/site/sitemap.js";
import { fill, isExternal } from "../apps/web/src/site/text.js";
import { versioned } from "../apps/web/src/viewer/load-circuit.js";
import { LESSONS } from "../apps/web/src/viewer/modules.js";
import { keepContext, orientDownstream } from "../scripts/cascade-bake.js";

type Messages = { [key: string]: string | Messages };
const en = JSON.parse(
  readFileSync(
    new URL("../apps/web/messages/en.json", import.meta.url),
    "utf8",
  ),
) as Messages;

/** One English message by its dotted key. */
function message(key: string): string {
  let at: string | Messages | undefined = en;
  for (const part of key.split(".")) {
    at = typeof at === "object" ? at[part] : undefined;
  }
  if (typeof at !== "string") throw new Error(`no message ${key}`);
  return at;
}

/** The link tags a message uses, in order. */
function tagsIn(text: string): string[] {
  return [...text.matchAll(/<([a-z]+)>/g)].map((match) => match[1]!);
}

/** Three neurons: an input, a relay, and a context cell, and a few spikes. */
function sampleInput(): CascadeInput {
  return {
    dataset: "MaleCNS v1.0",
    license: "CC BY 4.0",
    citation: "Berg et al. 2026",
    lesson: "escape",
    seed: 1,
    stimulus: { colorGroup: "input", hz: 40, ms: 200 },
    tickMs: 0.1,
    ticks: 640,
    groups: [
      {
        colorGroup: "input",
        color: "#38BDF8",
        count: 1,
        firstTick: 2,
      },
      {
        colorGroup: "relay",
        color: "#F87171",
        count: 1,
        firstTick: 40,
      },
    ],
    frame: { center: [5, 5, 0], radius: 8 },
    neuronGroup: [0, 1, -1],
    paths: [
      Float32Array.from([0, 0, 0, 3.3, 1.7, 0, 6.1, 2.2, 0.5]),
      Float32Array.from([6, 2, 0, 8.4, 7.9, 1, 10, 10, 1]),
      Float32Array.from([1, 9, 0, 2, 8, 0]),
    ],
    spikes: [
      [1, 40],
      [0, 2],
      [2, 17],
      [0, 90],
    ],
  };
}

describe("escape loop file", () => {
  it("round-trips shapes within half a quantization step and spikes exactly", () => {
    const input = sampleInput();
    const file = encodeCascade({ ...input, resolution: 256 });
    const cascade = readCascade(JSON.parse(JSON.stringify(file)));
    assert.deepEqual(Array.from(cascade.neuronGroup), [0, 1, -1]);
    for (let neuron = 0; neuron < input.paths.length; neuron++) {
      const original = input.paths[neuron]!;
      const start = cascade.paths.offset[neuron]!;
      assert.equal(cascade.paths.offset[neuron + 1]! - start, original.length);
      original.forEach((value, index) => {
        const decoded = cascade.paths.data[start + index]!;
        assert.ok(Math.abs(decoded - value) <= file.step / 2 + 1e-6);
      });
    }
    assert.deepEqual(Array.from(cascade.spikeTick), [2, 17, 40, 90]);
    assert.deepEqual(Array.from(cascade.spikeNeuron), [0, 2, 1, 0]);
    assert.equal(cascade.groups[1]?.firstTick, 40);
  });

  it("refuses a missing or damaged file", () => {
    assert.throws(() => readCascade(null), /missing or from another version/);
    assert.throws(() => readCascade({ format: 2 }), /another version/);
    const file = encodeCascade(sampleInput());
    assert.throws(
      () => readCascade({ ...file, points: file.points.slice(1) }),
      /damaged/,
    );
    assert.throws(
      () => readCascade({ ...file, spikes: { neuron: [9], tick: [1] } }),
      /damaged/,
    );
    assert.throws(
      () => encodeCascade({ ...sampleInput(), spikes: [[7, 1]] }),
      /outside the circuit/,
    );
  });
});

describe("loop timeline", () => {
  const run = { ticks: 640, tickMs: 0.1 };

  it("rests, runs 100 times slower than life, then holds at the end", () => {
    assert.ok(flyMsAt(0, run) < 0);
    assert.equal(flyMsAt(LEAD_MS, run), 0);
    assert.ok(Math.abs(flyMsAt(wallMsAt(13.2), run) - 13.2) < 1e-9);
    assert.equal(flyMsAt(LOOP_MS - 1, run), 64);
    assert.equal(FLY_MS_PER_WALL_MS, 0.01);
  });

  it("repeats every pass and leaves time to fade and rest", () => {
    assert.equal(
      flyMsAt(LOOP_MS + LEAD_MS + 500, run),
      flyMsAt(LEAD_MS + 500, run),
    );
    const end = wallMsAt(CASCADE_SPAN_MS);
    assert.ok(end + 500 <= LOOP_MS, "rest after the run");
    assert.equal(fadeAt(LEAD_MS, run), 1);
    assert.ok(Math.abs(fadeAt(end - FADE_MS / 2, run) - 0.5) < 1e-9);
    assert.equal(fadeAt(end + 1, run), 0);
    assert.equal(fadeAt(LOOP_MS + LEAD_MS, run), 1);
  });

  it("says in its caption what the timeline does", () => {
    const caption = fill(message("landing.loop.caption"), {
      spanMs: CASCADE_SPAN_MS,
      slowdown: Math.round(1 / FLY_MS_PER_WALL_MS),
    });
    assert.match(caption, new RegExp(`first ${CASCADE_SPAN_MS} ms`));
    assert.match(
      caption,
      new RegExp(`slowed ${Math.round(1 / FLY_MS_PER_WALL_MS)} times`),
    );
  });
});

describe("loop scene", () => {
  const cascade = readCascade(
    JSON.parse(JSON.stringify(encodeCascade(sampleInput()))),
  );

  it("fits every neuron inside the canvas", () => {
    const scene = buildScene(cascade, 400, 250);
    for (let at = 0; at < scene.xy.length; at += 2) {
      assert.ok(scene.xy[at]! >= 0 && scene.xy[at]! <= 400);
      assert.ok(scene.xy[at + 1]! >= 0 && scene.xy[at + 1]! <= 250);
    }
  });

  it("flashes a neuron when it spikes and lets it fade on wall time", () => {
    const scene = buildScene(cascade, 400, 250);
    const levels = new Float32Array(3);
    const spike = wallMsAt(4);
    assert.equal(flashAt(scene, spike, levels)[1], 1);
    assert.ok(
      Math.abs(flashAt(scene, spike + FLASH_MS / 2, levels)[1]! - 0.5) < 1e-6,
    );
    assert.equal(flashAt(scene, spike + FLASH_MS + 1, levels)[1], 0);
    // Stateless: jumping back gives the same frame again.
    assert.equal(flashAt(scene, spike, levels)[1], 1);
  });

  it("sends dots only along lesson cells, start to end", () => {
    const scene = buildScene(cascade, 400, 250);
    const dots = dotsAt(scene, wallMsAt(4) + 100);
    assert.ok(dots.length > 0);
    for (const dot of dots) {
      assert.ok(dot.group >= 0);
      assert.ok(dot.progress >= 0 && dot.progress <= 1);
    }
  });

  it("stills on the moment the last group has fired", () => {
    assert.ok(stillMoment(cascade) > wallMsAt(4));
    const svg = cascadeSvg(cascade, 300, 200);
    assert.match(svg, /^<svg[^>]+width="300" height="200"/);
    assert.match(svg, /<path d="M/);
  });
});

describe("cascade bake helpers", () => {
  it("keeps a fixed third of the context cells", () => {
    let kept = 0;
    for (let neuron = 0; neuron < 10_000; neuron++) {
      if (keepContext(neuron)) kept += 1;
      assert.equal(keepContext(neuron), keepContext(neuron));
    }
    assert.ok(kept > 3_200 && kept < 3_800, `kept ${kept}`);
  });

  it("turns each lesson cell to run the way the signal travels", () => {
    const paths: (Float32Array | null)[] = [
      // Input cell drawn with its end away from the relay.
      Float32Array.from([10, 0, 0, 20, 0, 0]),
      // Relay drawn from the nerve cord up to the brain.
      Float32Array.from([10, -40, 0, 10, 0, 0]),
      // Output cell drawn with its start away from the relay's end.
      Float32Array.from([30, -40, 0, 11, -40, 0]),
    ];
    const groups = new Map([
      ["input", Uint32Array.from([0])],
      ["relay", Uint32Array.from([1])],
      ["output", Uint32Array.from([2])],
    ]);
    orientDownstream(paths, groups, ["input", "relay", "output"]);
    assert.deepEqual(Array.from(paths[1]!), [10, 0, 0, 10, -40, 0]);
    assert.deepEqual(Array.from(paths[0]!), [20, 0, 0, 10, 0, 0]);
    assert.deepEqual(Array.from(paths[2]!), [11, -40, 0, 30, -40, 0]);
  });
});

describe("site copy", () => {
  it("asks for coffee in the agreed words, nowhere near a lesson", () => {
    assert.equal(
      message("support.blurb"),
      "WiredMind is free and always will be. If it helped your class, coffee keeps the server humming.",
    );
    assert.equal(message("support.coffee"), "☕ Buy me a coffee");
    assert.equal(COFFEE_URL, "https://buymeacoffee.com/guydahn");
    assert.equal(
      fill(message("footer.builtBy"), { author: AUTHOR.name }),
      "Built by Guy Dahan",
    );
  });

  it("credits the institutions behind the neurons, with a link to each", () => {
    assert.deepEqual(
      tagsIn(message("footer.credits")).map(
        (tag) => LINK_TAGS[tag as keyof typeof LINK_TAGS],
      ),
      [
        LINKS.maleCns,
        LINKS.janelia,
        LINKS.cambridge,
        LINKS.mrcLmb,
        LINKS.googleResearch,
        LINKS.ccBy,
      ],
    );
  });

  it("links only to https sites or pages that exist", () => {
    const pages = new Set([
      "/",
      "/about",
      ...LESSONS.map((entry) => entry.path),
    ]);
    for (const href of Object.values(LINK_TAGS)) {
      if (isExternal(href)) assert.match(href, /^https:\/\//);
      else assert.ok(pages.has(href.split("#")[0]!), `no page for ${href}`);
    }
    assert.match(LINKS.translate, /CONTRIBUTING\.md#translations$/);
  });

  it("points a lesson at the next one, or at the other two once there is no next", () => {
    assert.equal(
      LESSONS.length,
      3,
      "this test's lesson-by-lesson checks assume 3",
    );
    for (const entry of LESSONS) {
      const after = LESSONS.find((item) => item.number === entry.number + 1);
      if (entry.number < LESSONS.length) {
        assert.ok(after, `lesson ${entry.number} has no next lesson`);
      } else {
        assert.equal(after, undefined, "the last lesson has no next lesson");
      }
    }
    const [one, two, three] = LESSONS;
    assert.equal(
      LESSONS.find((item) => item.number === one!.number + 1)!.id,
      two!.id,
    );
    assert.equal(
      LESSONS.find((item) => item.number === two!.number + 1)!.id,
      three!.id,
    );
    assert.equal(
      LESSONS.find((item) => item.number === three!.number + 1),
      undefined,
    );
    assert.deepEqual(
      LESSONS.filter((item) => item.id !== three!.id).map((item) => item.id),
      [one!.id, two!.id],
    );
  });

  it("says who made it", () => {
    const body = fill(message("about.who.body"), { author: AUTHOR.name });
    assert.match(body, /Guy Dahan/);
    assert.match(body, /Tel Aviv/);
    assert.match(body, /September 2026/);
    assert.equal(message("about.who.website"), "guy-dev.com");
    assert.equal(AUTHOR.website, "https://guy-dev.com");
  });

  it("fills templates and leaves unknown names alone", () => {
    assert.equal(
      fill("Lesson {n} of {total}", { n: 2 }),
      "Lesson 2 of {total}",
    );
    assert.equal(
      fill(message("landing.loop.clock"), { ms: "4.2" }),
      "4.2 ms of fly time",
    );
    assert.equal(isExternal("https://doi.org/x"), true);
    assert.equal(isExternal("/about"), false);
  });
});

describe("site metadata", () => {
  it("describes the site, the project, and its author for search engines", () => {
    const graph = homeJsonLd({ locale: "he", description: "x" })[
      "@graph"
    ] as unknown as Record<string, unknown>[];
    const byType = (type: string) =>
      graph.find((node) => node["@type"] === type) as Record<string, unknown>;
    const person = byType("Person");
    const website = byType("WebSite");
    const organization = byType("Organization");
    assert.equal(person.name, "Guy Dahan");
    assert.equal(person.url, "https://guy-dev.com");
    assert.ok((person.sameAs as string[]).includes(AUTHOR.github));
    assert.deepEqual(website.author, { "@id": person["@id"] });
    assert.deepEqual(website.creator, { "@id": person["@id"] });
    assert.deepEqual(organization.founder, { "@id": person["@id"] });
    assert.equal(website.url, `${SITE_URL}/he`);
    assert.equal(website.inLanguage, "he");
    assert.equal(byType("BreadcrumbList")["@type"], "BreadcrumbList");
    assert.doesNotMatch(jsonLdScript({ bad: "</script>" }), /<\/script>/);
  });

  it("describes each lesson as a free learning resource, with its place in the site", () => {
    const graph = pageJsonLd(
      "ar",
      [
        { name: "WiredMind", path: "/" },
        { name: "Lesson", path: "/modules/escape" },
      ],
      lessonJsonLd({
        locale: "ar",
        path: "/modules/escape",
        name: "n",
        description: "d",
        teaches: "t",
        educationalLevel: "e",
        learningResourceType: "l",
        audience: "a",
        keywords: ["k"],
      }),
    )["@graph"] as unknown as Record<string, unknown>[];
    const lesson = graph.find((node) => node["@type"] === "LearningResource")!;
    assert.equal(lesson.inLanguage, "ar");
    assert.equal(lesson.isAccessibleForFree, true);
    assert.equal(lesson.url, `${SITE_URL}/ar/modules/escape`);
    const crumbs = graph.find((node) => node["@type"] === "BreadcrumbList")!;
    assert.deepEqual(
      (crumbs.itemListElement as { position: number; item: string }[]).map(
        (crumb) => [crumb.position, crumb.item],
      ),
      [
        [1, `${SITE_URL}/ar`],
        [2, `${SITE_URL}/ar/modules/escape`],
      ],
    );
  });

  it("gives every page a full share card and every language's address", () => {
    const meta = pageMetadata({
      locale: "he",
      path: "/modules/escape",
      title: "t · WiredMind",
      shareTitle: "t",
      description: "Find the wire.",
      image: "/og/he/lesson-escape.png?v=1",
      imageAlt: "alt",
    });
    const alternates = meta.alternates as {
      canonical: string;
      languages: Record<string, string>;
    };
    assert.equal(alternates.canonical, `${SITE_URL}/he/modules/escape`);
    assert.equal(Object.keys(alternates.languages).length, LOCALES.length + 1);
    assert.equal(
      alternates.languages["x-default"],
      `${SITE_URL}/en/modules/escape`,
    );
    const og = meta.openGraph as Record<string, unknown>;
    assert.equal(og.type, "website");
    assert.equal(og.siteName, "WiredMind");
    assert.equal(og.locale, "he_IL");
    assert.equal(og.url, `${SITE_URL}/he/modules/escape`);
    assert.equal(
      (og.images as { url: string }[])[0]?.url,
      "/og/he/lesson-escape.png?v=1",
    );
    const twitter = meta.twitter as Record<string, unknown>;
    assert.equal(twitter.card, "summary_large_image");
    assert.equal(languageAlternates("/")["x-default"], `${SITE_URL}/`);
  });

  it("lists every page in one sitemap per language, each naming its translations", () => {
    const index = sitemapIndexXml(new Map());
    for (const locale of LOCALES) {
      assert.match(
        index,
        new RegExp(`<loc>${SITE_URL}/sitemaps/${locale}\\.xml</loc>`),
      );
    }
    const xml = localeSitemapXml("he", () => "2026-09-27T10:00:00+03:00");
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(
      urls,
      SITEMAP_PAGES.map(
        (page) => `${SITE_URL}/he${page.path === "/" ? "" : page.path}`,
      ),
    );
    const links = xml.match(/<xhtml:link rel="alternate"/g) ?? [];
    assert.equal(links.length, SITEMAP_PAGES.length * (LOCALES.length + 1));
    assert.match(xml, /hreflang="x-default" href="https:\/\/[^"]+\/"/);
    assert.match(xml, /<lastmod>2026-09-27T10:00:00\+03:00<\/lastmod>/);
    assert.doesNotMatch(xml, /sim-bench/);
  });

  it("asks for data files by release, so a year-long cache never goes stale", () => {
    assert.equal(
      versioned("/data/escape.glb", "data-v1"),
      "/data/escape.glb?v=data-v1",
    );
    assert.equal(
      versioned("/data/a.json?x=1", "data-v2"),
      "/data/a.json?x=1&v=data-v2",
    );
    assert.equal(versioned("/data/escape.glb", undefined), "/data/escape.glb");
  });
});
