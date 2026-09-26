import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ViewerCommand } from "../apps/web/src/viewer/commands.js";
import { findLesson } from "../apps/web/src/viewer/modules.js";
import { MAX_PAUSE_MS, Playback } from "../apps/web/src/viewer/playback.js";
import {
  decodeReplay,
  encodeReplay,
  MAX_ACTIONS,
  replayProblem,
  replayUrl,
  type Replay,
} from "../apps/web/src/viewer/replay.js";
import { createViewerSession } from "../apps/web/src/viewer/session.js";
import { olfactoryCircuit } from "./sim-circuits.js";

const sample: Replay = {
  lessonId: "smell-memory",
  seed: 4_000_000_001,
  actions: [
    {
      tick: 0,
      wallMs: 3120,
      command: { type: "stimulate", colorGroup: "orn" },
    },
    {
      tick: 2450,
      wallMs: 9870,
      command: { type: "stimulate", colorGroup: "orn" },
    },
    {
      tick: 4990,
      wallMs: 15400,
      command: { type: "silence", colorGroup: "kc", on: true },
    },
    {
      tick: 4990,
      wallMs: 15900,
      command: { type: "stimulate", colorGroup: "orn" },
    },
    {
      tick: 7433,
      wallMs: 24010,
      command: { type: "silence", colorGroup: "kc", on: false },
    },
  ],
};

describe("replay links", () => {
  it("round-trips lesson, seed, and every press with its tick", () => {
    const decoded = decodeReplay(encodeReplay(sample));
    assert.equal(decoded.lessonId, sample.lessonId);
    assert.equal(decoded.seed, sample.seed);
    assert.deepEqual(
      decoded.actions.map((action) => [action.tick, action.command]),
      sample.actions.map((action) => [action.tick, action.command]),
    );
    for (const [index, action] of decoded.actions.entries()) {
      const original = sample.actions[index]!;
      assert.ok(Math.abs(action.wallMs - original.wallMs) <= 5, `${index}`);
    }
  });

  it("stays short enough to paste into a chat", () => {
    const encoded = encodeReplay(sample);
    assert.match(encoded, /^[A-Za-z0-9_-]+$/);
    assert.ok(encoded.length < 80, `${encoded.length} characters`);
    const lesson: Replay = {
      lessonId: "compass",
      seed: 13,
      actions: Array.from({ length: 30 }, (_, index) => ({
        tick: index * 9000,
        wallMs: index * 7000,
        command: { type: "stimulate", colorGroup: "turn-left" },
      })),
    };
    assert.ok(encodeReplay(lesson).length < 260);
  });

  it("links to the plain lesson page when there is nothing to replay", () => {
    const empty = { lessonId: "escape", seed: 1, actions: [] };
    assert.equal(
      replayUrl("https://x.test", "/modules/escape", empty),
      "https://x.test/modules/escape",
    );
    assert.match(
      replayUrl("https://x.test", "/", sample),
      /^https:\/\/x\.test\/\?r=[A-Za-z0-9_-]+$/,
    );
  });

  it("refuses broken, cut-off, and oversized links", () => {
    const good = encodeReplay(sample);
    assert.throws(() => decodeReplay(""), /empty or too long/);
    assert.throws(() => decodeReplay("not base64!"), /broken/);
    assert.throws(() => decodeReplay(good.slice(0, -3)), /broken|cut off/);
    assert.throws(() => decodeReplay(`${good}AA`), /broken/);
    assert.throws(() => decodeReplay("Ag"), /different version/);
    assert.throws(() => decodeReplay("A".repeat(5000)), /too long/);
    const flood: Replay = {
      ...sample,
      actions: Array.from({ length: MAX_ACTIONS + 1 }, (_, index) => ({
        tick: index,
        wallMs: index,
        command: { type: "stimulate", colorGroup: "orn" },
      })),
    };
    assert.throws(() => decodeReplay(encodeReplay(flood)), /too many/);
    const endless: Replay = {
      ...sample,
      actions: [
        {
          tick: 50_000_000,
          wallMs: 0,
          command: { type: "stimulate", colorGroup: "orn" },
        },
      ],
    };
    assert.throws(() => decodeReplay(encodeReplay(endless)), /too long/);
  });

  it("checks the presses against the lesson's buttons", () => {
    const smell = findLesson("smell-memory")!.module;
    assert.equal(replayProblem(sample, smell), null);
    const foreign: Replay = {
      ...sample,
      actions: [
        {
          tick: 0,
          wallMs: 0,
          command: { type: "stimulate", colorGroup: "kc" },
        },
      ],
    };
    assert.match(replayProblem(foreign, smell) ?? "", /no longer has/);
  });
});

/**
 * Stands in for the scene: runs frames of uneven size, steps only while
 * something is happening, and applies each press at the top of a frame.
 */
function perform(
  script: { atFrame: number; command: ViewerCommand }[],
  frames: number[],
): { replay: Replay; raster: string[]; clock: number } {
  const circuit = olfactoryCircuit();
  const session = createViewerSession(circuit.graph, groupsOf(circuit), 7);
  const raster: string[] = [];
  const actions: Replay["actions"] = [];
  let quietFrames = 0;
  frames.forEach((budget, frame) => {
    for (const item of script) {
      if (item.atFrame !== frame || item.command.type === "reset") continue;
      const { command } = item;
      actions.push({
        tick: session.clock,
        wallMs: frame * 16,
        command:
          command.type === "stimulate"
            ? { type: "stimulate", colorGroup: command.colorGroup }
            : {
                type: "silence",
                colorGroup: command.colorGroup,
                on: command.on,
              },
      });
      if (command.type === "stimulate") {
        session.stimulate(command.colorGroup, 120, 30);
      } else session.setSilenced(command.colorGroup, command.on);
      quietFrames = 0;
    }
    if (!session.hasDrive() && quietFrames > 3) return;
    const spiked = tickByTick(session, budget, raster);
    quietFrames = spiked || session.hasDrive() ? 0 : quietFrames + 1;
  });
  return {
    replay: { lessonId: "smell-memory", seed: 7, actions },
    raster,
    clock: session.clock,
  };
}

function tickByTick(
  session: ReturnType<typeof createViewerSession>,
  ticks: number,
  raster: string[],
): boolean {
  let spiked = false;
  for (let tick = 0; tick < ticks; tick++) {
    const { spikes } = session.advance(1);
    const on: number[] = [];
    spikes.forEach((value, index) => {
      if (value) on.push(index);
    });
    if (on.length > 0) spiked = true;
    raster.push(on.join(","));
  }
  return spiked;
}

function groupsOf(circuit: ReturnType<typeof olfactoryCircuit>) {
  return new Map<string, Uint32Array>([
    ["orn", Uint32Array.from(circuit.odorPn)],
    ["kc", Uint32Array.from(circuit.kc)],
    ["mbon", Uint32Array.from(circuit.mbon)],
  ]);
}

describe("replay playback", () => {
  it("repeats a run spike for spike through a share link, with other frame sizes", () => {
    const frames = Array.from(
      { length: 900 },
      (_, index) => 3 + ((index * 7) % 17),
    );
    const original = perform(
      [
        { atFrame: 2, command: { type: "stimulate", colorGroup: "orn" } },
        {
          atFrame: 140,
          command: { type: "silence", colorGroup: "kc", on: true },
        },
        { atFrame: 175, command: { type: "stimulate", colorGroup: "orn" } },
        { atFrame: 176, command: { type: "stimulate", colorGroup: "orn" } },
        {
          atFrame: 420,
          command: { type: "silence", colorGroup: "kc", on: false },
        },
        { atFrame: 455, command: { type: "stimulate", colorGroup: "orn" } },
      ],
      frames,
    );
    assert.ok(original.raster.some((row) => row.length > 0));
    const shared = decodeReplay(encodeReplay(original.replay));

    const circuit = olfactoryCircuit();
    const session = createViewerSession(circuit.graph, groupsOf(circuit), 1);
    session.reset(shared.seed);
    const raster: string[] = [];
    const stepper = {
      get clock() {
        return session.clock;
      },
      advance(ticks: number) {
        tickByTick(session, ticks, raster);
        return session.advance(0, true);
      },
    };
    const playback = new Playback(shared);
    let wall = 0;
    for (
      let frame = 0;
      session.clock < original.clock && frame < 20_000;
      frame++
    ) {
      wall += 16;
      const budget = 11;
      const outcome = playback.frame(
        stepper,
        budget,
        wall,
        () => !session.hasDrive(),
        (command) => {
          if (command.type === "stimulate") {
            session.stimulate(command.colorGroup, 120, 30);
          } else session.setSilenced(command.colorGroup, command.on);
        },
      );
      if (outcome.left > 0) stepper.advance(outcome.left);
    }
    assert.ok(playback.finished);
    assert.deepEqual(raster.slice(0, original.raster.length), original.raster);
  });

  it("waits out a recorded pause only while the brain is quiet", () => {
    const replay: Replay = {
      lessonId: "smell-memory",
      seed: 1,
      actions: [
        {
          tick: 0,
          wallMs: 0,
          command: { type: "stimulate", colorGroup: "orn" },
        },
        {
          tick: 0,
          wallMs: 60_000,
          command: { type: "stimulate", colorGroup: "orn" },
        },
      ],
    };
    const applied: number[] = [];
    const stepper = {
      clock: 0,
      advance(ticks: number) {
        this.clock += ticks;
        return { spikes: new Uint8Array(0), finished: [] };
      },
    };
    const quiet = new Playback(replay);
    quiet.frame(
      stepper,
      10,
      1000,
      () => true,
      () => applied.push(1000),
    );
    quiet.frame(
      stepper,
      10,
      1000 + MAX_PAUSE_MS - 1,
      () => true,
      () => applied.push(2),
    );
    assert.deepEqual(applied, [1000]);
    quiet.frame(
      stepper,
      10,
      1000 + MAX_PAUSE_MS,
      () => true,
      () => applied.push(3),
    );
    assert.deepEqual(applied, [1000, 3]);

    const busy = new Playback(replay);
    const seen: number[] = [];
    busy.frame(
      stepper,
      10,
      5,
      () => false,
      () => seen.push(seen.length),
    );
    assert.deepEqual(seen, [0, 1], "a busy brain never holds a press back");
  });
});
