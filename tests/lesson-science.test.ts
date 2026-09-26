import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseGraphBin } from "../apps/web/src/sim/index.js";
import { compassWedges, type Wedge } from "../apps/web/src/viewer/compass.js";
import {
  assignGroups,
  bodyIndex,
  type NeuronRow,
} from "../apps/web/src/viewer/groups.js";
import {
  findLesson,
  type LessonEntry,
} from "../apps/web/src/viewer/modules.js";
import {
  createViewerSession,
  type ViewerSession,
} from "../apps/web/src/viewer/session.js";

/**
 * Every claim a lesson makes, run on the real MaleCNS circuits exactly as the
 * lesson drives them. The baked data is not in git, so these skip until
 * `pnpm data:fetch` has put it in apps/web/public/data.
 */

const DATA = new URL("../apps/web/public/data/", import.meta.url);
/**
 * Ticks per look. A neuron cannot fire twice in 1 ms (the refractory period
 * is 2.2 ms), so counting per millisecond misses no spike.
 */
const LOOK = 10;
const TICK_MS = 0.1;

type Circuit = {
  entry: LessonEntry;
  rows: NeuronRow[];
  groups: Map<string, Uint32Array>;
  session: (seed?: number) => ViewerSession;
};

function has(circuit: string): boolean {
  return ["graph.bin", "neurons.json"].every((part) =>
    existsSync(new URL(`${circuit}.${part}`, DATA)),
  );
}

function load(lessonId: string): Circuit {
  const entry = findLesson(lessonId)!;
  const name = entry.module.circuit;
  const graph = parseGraphBin(readFileSync(new URL(`${name}.graph.bin`, DATA)));
  const file = JSON.parse(
    readFileSync(new URL(`${name}.neurons.json`, DATA), "utf8"),
  ) as { neurons: NeuronRow[] };
  const rows = file.neurons.map((row) => ({
    id: row.id,
    type: row.type,
    colorGroup: row.colorGroup,
  }));
  const { groups } = assignGroups(rows, entry.module.groups);
  return {
    entry,
    rows,
    groups,
    session: (seed = entry.module.seed) =>
      createViewerSession(graph, groups, seed),
  };
}

/** A puff as the viewer runs it: the drive, then the settle, then stillness. */
function puff(
  circuit: Circuit,
  session: ViewerSession,
  colorGroup: string,
  watch: (tick: number, spikes: Uint8Array) => void = () => undefined,
) {
  const { stimulusHz, stimulusMs } = circuit.entry.module;
  session.stimulate(colorGroup, stimulusHz, stimulusMs);
  const start = session.clock;
  while (session.running()) {
    const { spikes } = session.advance(LOOK);
    watch(session.clock - start, spikes);
  }
}

function count(
  circuit: Circuit,
  session: ViewerSession,
  stimulus: string,
  groups: string[],
): { spikes: Record<string, number>; first: Record<string, number> } {
  const spikes: Record<string, number> = {};
  const first: Record<string, number> = {};
  for (const name of groups) spikes[name] = 0;
  puff(circuit, session, stimulus, (tick, out) => {
    for (const name of groups) {
      for (const index of circuit.groups.get(name) ?? []) {
        if (!out[index]) continue;
        spikes[name] = (spikes[name] ?? 0) + 1;
        first[name] ??= tick * TICK_MS;
      }
    }
  });
  return { spikes, first };
}

describe("smell-memory science", { skip: !has("olfactory") }, () => {
  const circuit = has("olfactory") ? load("smell-memory") : null;
  it("dims the pink readers when the Kenyon cells go quiet, and brings them back", () => {
    const lesson = circuit!;
    const session = lesson.session();
    const watched = ["orn", "pn", "kc", "mbon"];
    const open = count(lesson, session, "orn", watched);
    session.setSilenced("kc", true);
    const shut = count(lesson, session, "orn", watched);
    session.setSilenced("kc", false);
    const back = count(lesson, session, "orn", watched);
    assert.ok(open.spikes.kc! > 0 && open.spikes.mbon! > 0);
    assert.ok(shut.spikes.orn! > 0 && shut.spikes.pn! > 0, "the smell got in");
    assert.equal(shut.spikes.kc, 0);
    assert.ok(
      shut.spikes.mbon! < open.spikes.mbon! * 0.2,
      `pink ${shut.spikes.mbon} of ${open.spikes.mbon}`,
    );
    assert.ok(back.spikes.mbon! > open.spikes.mbon! * 0.5, "pink came back");
  });
});

describe("escape science", { skip: !has("escape") }, () => {
  const circuit = has("escape") ? load("escape") : null;
  const watched = ["looming", "gf", "jump"];

  it("fires the giant fiber within a few ms and the jump within 30 ms", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { spikes, first } = count(
        circuit!,
        circuit!.session(seed),
        "looming",
        watched,
      );
      assert.ok(first.gf! < 10, `seed ${seed}: giant fiber at ${first.gf} ms`);
      assert.ok(spikes.jump! > 0, `seed ${seed}: no jump`);
      assert.ok(first.jump! < 30, `seed ${seed}: jump at ${first.jump} ms`);
    }
  });

  it("loses the jump but keeps the looming signal when the giant fiber is silenced", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const session = circuit!.session(seed);
      session.setSilenced("gf", true);
      const shut = count(circuit!, session, "looming", watched);
      session.setSilenced("gf", false);
      const back = count(circuit!, session, "looming", watched);
      assert.ok(shut.spikes.looming! > 0, `seed ${seed}`);
      assert.equal(shut.spikes.gf, 0);
      assert.equal(shut.spikes.jump, 0, `seed ${seed}: jump without the fiber`);
      assert.ok(back.spikes.jump! > 0, `seed ${seed}: jump did not come back`);
    }
  });
});

type Bump = { angle: number; steadiness: number };

/** Heading of the compass neurons in 50 ms bins, and how still it held. */
function bump(circuit: Circuit, session: ViewerSession, group: string): Bump {
  const wedges = compassWedges(
    circuit.entry.module.compass!,
    bodyIndex(circuit.rows),
  );
  const bins: number[] = [];
  let x = 0;
  let y = 0;
  const add = (wedge: Wedge, spikes: Uint8Array) => {
    for (const index of wedge.neurons) {
      if (!spikes[index]) continue;
      x += Math.sin(wedge.angle);
      y += Math.cos(wedge.angle);
    }
  };
  puff(circuit, session, group, (tick, spikes) => {
    for (const wedge of wedges) add(wedge, spikes);
    if (tick % 500 === 0) {
      if (x !== 0 || y !== 0) bins.push(Math.atan2(x, y));
      x = 0;
      y = 0;
    }
  });
  let sx = 0;
  let sy = 0;
  for (const angle of bins) {
    sx += Math.sin(angle);
    sy += Math.cos(angle);
  }
  return {
    angle: Math.atan2(sx, sy),
    steadiness: bins.length ? Math.hypot(sx, sy) / bins.length : 0,
  };
}

function apart(a: number, b: number): number {
  const turn = 2 * Math.PI;
  const gap = (((a - b) % turn) + turn) % turn;
  return (Math.min(gap, turn - gap) * 180) / Math.PI;
}

/** Steps 3 and 4: the same right-turn puff with the ring neurons off, then on. */
function ringTest(circuit: Circuit, seed: number) {
  const session = circuit.session(seed);
  const right = bump(circuit, session, "turn-right");
  session.setSilenced("ring", true);
  const off = bump(circuit, session, "turn-right");
  session.setSilenced("ring", false);
  const on = bump(circuit, session, "turn-right");
  const drifted =
    apart(off.angle, on.angle) > 45 || off.steadiness < on.steadiness - 0.15;
  return { right, off, on, drifted };
}

describe("compass science", { skip: !has("visual") }, () => {
  const circuit = has("visual") ? load("compass") : null;

  it("swings the bump around the dial when the other turn signal fires", () => {
    // Across 24 seeds the two bumps sit 85 to 147 degrees apart (median 130),
    // each on its own side of the dial. Three wedges (68 deg) is plainly visible.
    for (const seed of [13, 1, 2, 3, 4, 11]) {
      const session = circuit!.session(seed);
      const left = bump(circuit!, session, "turn-left");
      const right = bump(circuit!, session, "turn-right");
      const gap = apart(left.angle, right.angle);
      assert.ok(gap > 68, `seed ${seed}: bumps ${gap.toFixed(0)} deg apart`);
      assert.ok(Math.sin(left.angle) < 0, `seed ${seed}: left bump not left`);
      assert.ok(
        Math.sin(right.angle) > 0,
        `seed ${seed}: right bump not right`,
      );
      assert.ok(left.steadiness > 0.6, `seed ${seed}: left bump wandered`);
      if (seed === circuit!.entry.module.seed) assert.ok(gap > 110);
    }
  });

  it("lets the bump slip without ring neurons and holds it again with them, on the lesson seed", () => {
    const { right, off, on, drifted } = ringTest(
      circuit!,
      circuit!.entry.module.seed,
    );
    assert.ok(drifted, `off ${JSON.stringify(off)} on ${JSON.stringify(on)}`);
    assert.ok(
      on.steadiness >= 0.6,
      `restored bump steadiness ${on.steadiness}`,
    );
    assert.ok(apart(on.angle, right.angle) < 45, "restored bump moved");
  });

  it("shows the slip on most seeds, so the lesson seed is typical rather than lucky", () => {
    let drifts = 0;
    const seeds = 12;
    for (let seed = 1; seed <= seeds; seed++) {
      if (ringTest(circuit!, seed).drifted) drifts += 1;
    }
    assert.ok(drifts >= seeds * 0.75, `slipped on ${drifts} of ${seeds} seeds`);
  });
});
