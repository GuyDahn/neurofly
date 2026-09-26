import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  centerline,
  packPaths,
  samplePath,
} from "../apps/web/src/viewer/centerline.js";
import { activityByGroup, FlashField } from "../apps/web/src/viewer/flash.js";
import { frameSphere } from "../apps/web/src/viewer/fit.js";
import { indicesByColorGroup } from "../apps/web/src/viewer/groups.js";
import { missingGroups, readModule } from "../apps/web/src/viewer/module.js";
import { createViewerSession } from "../apps/web/src/viewer/session.js";

const modulePath = new URL(
  "../apps/web/content/olfactory/module.json",
  import.meta.url,
);

describe("module.json", () => {
  const spec = readModule(JSON.parse(readFileSync(modulePath, "utf8")));

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
    for (const control of [...spec.stimuli, ...spec.silence]) {
      assert.equal(isOneSentence(control.label), true, control.colorGroup);
      assert.ok(control.name.length > 0);
    }
    for (const group of spec.groups) {
      assert.match(group.color, /^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("rejects a module that is not an object", () => {
    assert.throws(() => readModule(null), /module\.json/);
  });

  it("reports a cell group the circuit does not have", () => {
    assert.deepEqual(missingGroups(spec, new Set(["orn", "pn", "kc"])), [
      "mbon",
    ]);
  });
});

describe("neuron groups", () => {
  it("keeps neuron indices in file order", () => {
    const groups = indicesByColorGroup([
      { colorGroup: "orn" },
      { colorGroup: "pn" },
      { colorGroup: "orn" },
    ]);
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
