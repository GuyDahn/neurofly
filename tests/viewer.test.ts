import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  centerline,
  packPaths,
  samplePath,
} from "../apps/web/src/viewer/centerline.js";
import {
  CompassReadout,
  compassWedges,
} from "../apps/web/src/viewer/compass.js";
import { activityByGroup, FlashField } from "../apps/web/src/viewer/flash.js";
import { frameSphere } from "../apps/web/src/viewer/fit.js";
import { assignGroups } from "../apps/web/src/viewer/groups.js";
import { emptyGroups, readModule } from "../apps/web/src/viewer/module.js";
import {
  createViewerSession,
  ticksIn,
} from "../apps/web/src/viewer/session.js";

function content(path: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../apps/web/content/${path}`, import.meta.url),
      "utf8",
    ),
  );
}

const CIRCUITS = ["olfactory", "visual", "escape"] as const;

describe("module.json", () => {
  const spec = readModule(content("olfactory/module.json"));

  it("names the olfactory circuit and its classroom controls", () => {
    assert.equal(spec.circuit, "olfactory");
    assert.equal(spec.stimuli.length, 1);
    assert.ok(spec.silence.length >= 2 && spec.silence.length <= 3);
    assert.deepEqual(
      spec.stimuli.map((item) => item.colorGroup),
      ["orn"],
    );
    assert.deepEqual(
      spec.silence.map((item) => item.colorGroup),
      ["pn", "kc", "mbon"],
    );
  });

  it("gives every button and toggle one plain sentence", () => {
    for (const circuit of CIRCUITS) {
      const spec = readModule(content(`${circuit}/module.json`));
      for (const control of [...spec.stimuli, ...spec.silence]) {
        assert.equal(
          isOneSentence(control.label),
          true,
          `${circuit} ${control.colorGroup}`,
        );
        assert.ok(control.name.length > 0);
      }
      for (const group of spec.groups) {
        assert.match(group.color, /^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("gives each lesson group its own color", () => {
    for (const circuit of CIRCUITS) {
      const spec = readModule(content(`${circuit}/module.json`));
      const colors = spec.groups.map((group) => group.color.toLowerCase());
      assert.equal(new Set(colors).size, colors.length, circuit);
    }
  });

  it("reads the compass wedges of the heading circuit", () => {
    const visual = readModule(content("visual/module.json"));
    assert.equal(visual.seed, 13);
    assert.equal(visual.compass?.colorGroup, "compass");
    assert.equal(visual.compass?.wedges.length, 16);
    const ids = visual.compass?.wedges.flatMap((wedge) => wedge.ids) ?? [];
    assert.equal(new Set(ids).size, ids.length, "a cell sits in two wedges");
    const left = visual.groups.find((g) => g.colorGroup === "turn-left");
    const right = visual.groups.find((g) => g.colorGroup === "turn-right");
    assert.ok(left && right);
    assert.equal(
      left.match.ids.filter((id) => right.match.ids.includes(id)).length,
      0,
    );
  });

  it("rejects a group that matches nothing and a compass on an unknown group", () => {
    const raw = content("visual/module.json") as {
      groups: { match: object }[];
      compass: { colorGroup: string };
    };
    const empty = structuredClone(raw);
    empty.groups[0]!.match = {};
    assert.throws(() => readModule(empty), /matches nothing/);
    const lost = structuredClone(raw);
    lost.compass.colorGroup = "nowhere";
    assert.throws(() => readModule(lost), /unknown group/);
  });

  it("rejects a module that is not an object", () => {
    assert.throws(() => readModule(null), /module\.json/);
  });

  it("reports a cell group the circuit does not have", () => {
    const { groups } = assignGroups(
      [
        { id: 1, type: "ORN_DA1", colorGroup: "orn" },
        { id: 2, type: "DA1_lPN", colorGroup: "pn" },
        { id: 3, type: "KCg-m", colorGroup: "kc" },
      ],
      spec.groups,
    );
    assert.deepEqual(emptyGroups(spec, groups), ["mbon"]);
  });
});

describe("neuron groups", () => {
  it("claims a neuron by body id, then type, then baked color group, first group wins", () => {
    const match = (
      m: Partial<Record<"colorGroups" | "types" | "ids", unknown[]>>,
    ) => ({
      colorGroups: [],
      types: [],
      ids: [],
      ...m,
    });
    const { groups, member } = assignGroups(
      [
        { id: 10, type: "EPG", colorGroup: "compass" },
        { id: 11, type: "PEN_b(PEN2)", colorGroup: "compass" },
        { id: 12, type: "ER4d", colorGroup: "ring" },
        { id: 13, type: "Delta7", colorGroup: "compass" },
      ],
      [
        {
          colorGroup: "turn",
          label: "Turn",
          color: "#000001",
          match: match({ ids: [11] }),
        },
        {
          colorGroup: "epg",
          label: "E-PG",
          color: "#000002",
          match: match({ types: ["EPG"] }),
        },
        {
          colorGroup: "ring",
          label: "Ring",
          color: "#000003",
          match: match({ colorGroups: ["ring"] }),
        },
      ] as never,
    );
    assert.deepEqual(Array.from(groups.get("turn") ?? []), [1]);
    assert.deepEqual(Array.from(groups.get("epg") ?? []), [0]);
    assert.deepEqual(Array.from(groups.get("ring") ?? []), [2]);
    assert.deepEqual(Array.from(member), [1, 0, 2, -1]);
  });

  it("keeps neuron indices in file order", () => {
    const spec = readModule(content("olfactory/module.json"));
    const { groups } = assignGroups(
      [
        { id: 1, type: "ORN_DA1", colorGroup: "orn" },
        { id: 2, type: "DA1_lPN", colorGroup: "pn" },
        { id: 3, type: "ORN_VA2", colorGroup: "orn" },
      ],
      spec.groups,
    );
    assert.deepEqual(Array.from(groups.get("orn") ?? []), [0, 2]);
    assert.deepEqual(Array.from(groups.get("pn") ?? []), [1]);
  });
});

describe("flash", () => {
  it("fades a spike to zero in about 150 ms", () => {
    const flash = new FlashField(2);
    flash.mark(Uint8Array.of(1, 0));
    assert.equal(flash.values[0], 1);
    assert.equal(flash.bytes[0], 255);
    flash.decay(75);
    assert.ok(Math.abs((flash.values[0] ?? 0) - 0.5) < 1e-6);
    flash.decay(75);
    assert.equal(flash.values[0], 0);
    assert.equal(flash.busy, false);
  });

  it("measures the share of a group that is still lit", () => {
    const values = Float32Array.of(1, 0, 0.5);
    const groups = new Map<string, Uint32Array>([
      ["orn", Uint32Array.of(0, 1)],
      ["kc", Uint32Array.of(2)],
    ]);
    const activity = activityByGroup(values, groups);
    assert.equal(activity.orn, 0.5);
    assert.equal(activity.kc, 1);
  });
});

describe("camera fit", () => {
  it("moves back as the circuit gets larger", () => {
    const near = frameSphere(10, 42, 1);
    const far = frameSphere(40, 42, 1);
    assert.ok(far.distance > near.distance);
    assert.ok(near.near < near.far);
    assert.ok(near.distance > 10);
  });
});

describe("centerline", () => {
  it("walks a dot from one end of a neuron to the other", () => {
    const positions = new Float32Array([
      0, 0, 0, 0, 0.2, 0, 10, 1, 0, 10, 1.2, 0,
    ]);
    const path = centerline(positions, 4);
    const paths = packPaths([path]);
    const start = samplePath(paths, 0, 0);
    const end = samplePath(paths, 0, 1);
    const mid = samplePath(paths, 0, 0.5);
    assert.ok(start && end && mid);
    assert.ok((start?.[0] ?? 0) < (end?.[0] ?? 0));
    assert.ok((mid?.[0] ?? 0) > (start?.[0] ?? 0));
    assert.equal(samplePath(paths, 1, 0), null);
  });
});

describe("viewer session", () => {
  const graph = {
    neuronCount: 2,
    src: Uint32Array.of(0),
    dst: Uint32Array.of(1),
    weight: Int16Array.of(1),
    ntSign: Int8Array.of(1),
  };
  const groups = new Map<string, Uint32Array>([
    ["input", Uint32Array.of(0)],
    ["output", Uint32Array.of(1)],
  ]);

  it("reads spikes from a puff and goes quiet when that group is silenced", () => {
    const session = createViewerSession(graph, groups, 1);
    session.stimulate("input", 400, 500);
    const open = spikeCount(session, 20);
    assert.ok(open > 0, "the driven neuron did not spike");

    session.setSilenced("input", true);
    assert.equal(spikeCount(session, 20), 0);

    session.setSilenced("input", false);
    assert.ok(
      spikeCount(session, 20) > 0,
      "unsilence did not restore the puff",
    );
  });

  it("clears the puff and the silence mask on reset", () => {
    const session = createViewerSession(graph, groups, 1);
    session.stimulate("input", 400, 500);
    session.setSilenced("input", true);
    session.reset();
    assert.equal(session.hasDrive(), false);
    session.stimulate("input", 400, 500);
    assert.ok(spikeCount(session, 20) > 0);
  });

  it("counts whole ticks and ends a puff on its exact tick however the frames fall", () => {
    const coarse = createViewerSession(graph, groups, 2);
    const fine = createViewerSession(graph, groups, 2);
    coarse.stimulate("input", 300, 7.35);
    fine.stimulate("input", 300, 7.35);
    assert.equal(ticksIn(7.35), 74);
    const first = coarse.advance(1000);
    assert.deepEqual(first.finished, ["input"]);
    assert.equal(coarse.clock, 1000);
    let ended = -1;
    for (let tick = 0; tick < 1000; tick += 3) {
      const step = fine.advance(Math.min(3, 1000 - tick));
      if (step.finished.length > 0) ended = fine.clock;
    }
    assert.equal(
      ended,
      75,
      "the puff should end in the frame that holds tick 74",
    );
    assert.equal(fine.hasDrive(), false);
  });

  it("repeats a puff on a resting network whenever it starts", () => {
    const early = createViewerSession(graph, groups, 6);
    const late = createViewerSession(graph, groups, 6);
    late.advance(4321);
    early.stimulate("input", 250, 30);
    late.stimulate("input", 250, 30);
    const a: number[] = [];
    const b: number[] = [];
    for (let tick = 0; tick < 400; tick++) {
      a.push(early.advance(1).spikes[0] ?? 0);
      b.push(late.advance(1).spikes[0] ?? 0);
    }
    assert.ok(a.some(Boolean));
    assert.deepEqual(b, a);
  });

  it("keeps spikes across a split frame when asked to", () => {
    const session = createViewerSession(graph, groups, 3);
    session.stimulate("input", 2000, 5);
    const seen = new Set<number>();
    for (let tick = 0; tick < 50; tick++) {
      if (session.advance(1).spikes[0]) seen.add(tick);
    }
    const split = createViewerSession(graph, groups, 3);
    split.stimulate("input", 2000, 5);
    split.advance(10);
    const joined = split.advance(40, true).spikes[0];
    assert.equal(joined, seen.size > 0 ? 1 : 0);
  });

  it("starts over on a new seed", () => {
    const session = createViewerSession(graph, groups, 1);
    session.advance(55);
    session.reset(9);
    assert.equal(session.seed, 9);
    assert.equal(session.clock, 0);
  });

  it("replays the same spike count for the same seed", () => {
    const first = createViewerSession(graph, groups, 4);
    const second = createViewerSession(graph, groups, 4);
    first.stimulate("input", 120, 300);
    second.stimulate("input", 120, 300);
    assert.equal(spikeCount(second, 30), spikeCount(first, 30));
  });
});

function spikeCount(
  session: ReturnType<typeof createViewerSession>,
  steps: number,
): number {
  let total = 0;
  for (let step = 0; step < steps; step++) {
    total += session.step(10).spikes[0] ?? 0;
  }
  return total;
}

function isOneSentence(label: string): boolean {
  const text = label.trim();
  if (!text.endsWith(".")) return false;
  const body = text.slice(0, -1);
  return !body.includes(".") && text.split(/\s+/).length >= 4;
}

describe("compass readout", () => {
  const wedges = Array.from({ length: 16 }, (_, index) => ({
    glomerulus: `W${index}`,
    angle: (index * 22.5 * Math.PI) / 180,
    neurons: Uint32Array.of(index * 2, index * 2 + 1),
  }));

  it("points the needle at the lit wedge, clockwise from the top", () => {
    const readout = new CompassReadout(wedges);
    const values = new Float32Array(32);
    values[20] = 1; // wedge 10, 225 degrees
    values[21] = 1;
    for (let frame = 0; frame < 30; frame++) readout.update(values, 16);
    const heading = readout.heading();
    const degrees = ((heading.angle * 180) / Math.PI + 360) % 360;
    assert.ok(Math.abs(degrees - 225) < 0.5, `needle at ${degrees}`);
    assert.ok(heading.strength > 0.95);
    assert.equal(readout.levels[10], 1);
  });

  it("keeps its direction while the flashes fade, and reads nothing on an even ring", () => {
    const readout = new CompassReadout(wedges);
    const values = new Float32Array(32);
    values[4] = 1; // wedge 2, 45 degrees
    readout.update(values, 16);
    values[4] = 0;
    for (let frame = 0; frame < 5; frame++) readout.update(values, 16);
    const fading = readout.heading();
    assert.ok(
      Math.abs((((fading.angle * 180) / Math.PI + 360) % 360) - 45) < 0.5,
    );
    const even = new CompassReadout(wedges);
    even.update(new Float32Array(32).fill(1), 1000);
    assert.ok(even.heading().strength < 1e-6);
  });

  it("maps wedge body ids to neuron indices and refuses an empty wedge", () => {
    const indexOf = new Map([
      [501, 0],
      [502, 1],
    ]);
    const built = compassWedges(
      {
        colorGroup: "compass",
        wedges: [
          { glomerulus: "R1", angle: 90, ids: [501] },
          { glomerulus: "L8", angle: 180, ids: [502, 999] },
        ],
      },
      indexOf,
    );
    assert.deepEqual(
      built.map((wedge) => Array.from(wedge.neurons)),
      [[0], [1]],
    );
    assert.ok(Math.abs((built[0]?.angle ?? 0) - Math.PI / 2) < 1e-9);
    assert.throws(
      () =>
        compassWedges(
          {
            colorGroup: "compass",
            wedges: [{ glomerulus: "R2", angle: 0, ids: [999] }],
          },
          indexOf,
        ),
      /R2 has no neurons/,
    );
  });
});
