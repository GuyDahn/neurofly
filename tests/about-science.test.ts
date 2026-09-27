import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseGraphBin } from "../apps/web/src/sim/index.js";
import { readCascade } from "../apps/web/src/site/cascade.js";
import { assignGroups } from "../apps/web/src/viewer/groups.js";
import { plainText } from "../apps/web/src/viewer/lesson.js";
import { findLesson } from "../apps/web/src/viewer/modules.js";
import { buildCascade } from "../scripts/cascade-bake.js";

/**
 * The about page and the landing loop quote numbers from the real circuits.
 * These checks keep the copy true to the data it describes. Like
 * lesson-science.test.ts they skip until `pnpm data:fetch` has run.
 */

const DATA = new URL("../apps/web/public/data/", import.meta.url);
const CIRCUITS = ["olfactory", "visual", "escape"] as const;
const ready = CIRCUITS.every((name) =>
  ["graph.bin", "neurons.json", "glb"].every((part) =>
    existsSync(new URL(`${name}.${part}`, DATA)),
  ),
);

type Row = {
  id: number;
  type: string;
  colorGroup: string;
  neurotransmitter: string;
};

function rows(circuit: string): Row[] {
  const file = JSON.parse(
    readFileSync(new URL(`${circuit}.neurons.json`, DATA), "utf8"),
  ) as { neurons: Row[] };
  return file.neurons;
}

type Item = { title: string; body: string };

const about = (
  JSON.parse(
    readFileSync(
      new URL("../apps/web/messages/en.json", import.meta.url),
      "utf8",
    ),
  ) as {
    about: {
      real: {
        realItems: Record<string, Item>;
        simplifiedItems: Record<string, Item>;
      };
    };
  }
).about.real;
/** The about page's English, as a reader sees it: links are just their words. */
const aboutText = [
  ...Object.values(about.realItems),
  ...Object.values(about.simplifiedItems),
].map(
  (item) => `${item.title} ${plainText(item.body).replace(/<\/?\w+>/g, "")}`,
);

function claims(needle: string): boolean {
  return aboutText.some((line) => line.includes(needle));
}

describe("about page numbers", { skip: !ready }, () => {
  it("gives the real size of each lesson's circuit", () => {
    const sizes = CIRCUITS.map((name) => rows(name).length);
    const low = Math.min(...sizes).toLocaleString("en-US");
    const high = Math.max(...sizes).toLocaleString("en-US");
    assert.ok(claims(`${low} to ${high} reconstructed neurons`));
    assert.ok(claims(`subcircuit of ${low} to ${high} neurons`));
  });

  it("counts the giant fiber's chemical synapses onto the jump neurons", () => {
    const entry = findLesson("escape")!;
    const neurons = rows("escape");
    const graph = parseGraphBin(
      readFileSync(new URL("escape.graph.bin", DATA)),
    );
    const { groups } = assignGroups(neurons, entry.module.groups);
    const gf = new Set(groups.get("gf"));
    const jump = new Set(groups.get("jump"));
    let synapses = 0;
    for (let edge = 0; edge < graph.src.length; edge++) {
      if (!gf.has(graph.src[edge]!) || !jump.has(graph.dst[edge]!)) continue;
      synapses += graph.weight[edge]!;
      assert.equal(graph.ntSign[edge], 1, "the giant fiber is cholinergic");
    }
    assert.ok(claims(`Here that link is its ${synapses} chemical synapses.`));
    assert.ok(
      claims(`fires all ${groups.get("looming")!.length} looming cells`),
    );
  });

  it("drives every receptor neuron in the smell lesson", () => {
    const entry = findLesson("smell-memory")!;
    const { groups } = assignGroups(rows("olfactory"), entry.module.groups);
    const count = groups.get("orn")!.length.toLocaleString("en-US");
    assert.ok(claims(`fires all ${count} receptor neurons in the cut`));
    assert.equal(entry.module.stimulusHz, 40);
    assert.equal(entry.module.stimulusMs, 200);
    const escape = findLesson("escape")!.module;
    assert.equal(escape.stimulusHz, 40);
    assert.equal(escape.stimulusMs, 200);
    const compass = findLesson("compass")!.module;
    assert.equal(compass.stimulusHz, 60);
    assert.equal(compass.stimulusMs, 800);
    assert.ok(
      claims(
        "(40 Hz for 200 ms in the smell and escape lessons, 60 Hz for 800 ms for the turn neurons)",
      ),
    );
  });

  it("has no APL neuron and no dopamine neurons in the smell circuit", () => {
    const smell = rows("olfactory");
    assert.equal(smell.filter((row) => row.type.startsWith("APL")).length, 0);
    assert.equal(
      smell.filter((row) => row.neurotransmitter === "dopamine").length,
      0,
    );
    assert.ok(claims("no dopamine neurons"));
    assert.ok(claims("leaves out the APL neuron"));
  });

  it("uses inhibitory ring neurons in the compass circuit", () => {
    const entry = findLesson("compass")!;
    const visual = rows("visual");
    const { groups } = assignGroups(visual, entry.module.groups);
    const ring = groups.get("ring")!;
    assert.ok(ring.length > 0);
    for (const index of ring) {
      assert.equal(visual[index]?.neurotransmitter, "gaba");
    }
    assert.ok(claims("removes their inhibition of the compass"));
  });
});

describe("landing loop on the real escape circuit", { skip: !ready }, () => {
  it("fires the looming cells, then the giant fiber, then the jump neurons within 30 ms", async () => {
    const cascade = readCascade(
      JSON.parse(JSON.stringify(await buildCascade(fileURLToPath(DATA)))),
    );
    const first = Object.fromEntries(
      cascade.groups.map((group) => [
        group.colorGroup,
        group.firstTick === null ? Infinity : group.firstTick * cascade.tickMs,
      ]),
    );
    assert.ok(first.looming! < first.gf!, "eyes before the escape wire");
    assert.ok(first.gf! < first.jump!, "escape wire before the legs");
    // The escape lesson promises the jump within 30 milliseconds.
    assert.ok(first.jump! <= 30, `jump at ${first.jump} ms`);
    assert.equal(
      cascade.groups.find((group) => group.colorGroup === "looming")?.count,
      304,
    );
  });

  it("bakes the same file every time", async () => {
    const a = JSON.stringify(await buildCascade(fileURLToPath(DATA)));
    const b = JSON.stringify(await buildCascade(fileURLToPath(DATA)));
    assert.equal(a, b);
  });
});
