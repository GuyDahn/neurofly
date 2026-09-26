import { createSim, TICK_US } from "../sim/index.js";
import type { SimGraph, Simulator } from "../sim/index.js";

export type StepResult = {
  /** Spikes from the whole advance. Valid until the next advance, step, or reset. */
  spikes: Uint8Array;
  finished: string[];
};

type Drive = {
  hz: number;
  /** Session tick the puff stops on. */
  endTick: number;
};

/**
 * Fly time the brain keeps running after the last puff ends, so the cascade
 * can finish. Then it holds still until the next command. Some cut-out
 * circuits (the visual one) have excitatory loops that would otherwise
 * reverberate forever without the inhibition left outside the cut.
 */
export const SETTLE_MS = 150;

/** Whole integration ticks in `ms`, never fewer than one. */
export function ticksIn(ms: number): number {
  return Math.max(1, Math.round((ms * 1000) / TICK_US));
}

/**
 * Classroom controls on a Day 2 simulator.
 *
 * Time is a count of 0.1 ms ticks since the session started or last reset.
 * Puffs end on an exact tick, so the same commands on the same ticks replay
 * the same spikes however the frames happened to fall.
 *
 * Silence is sticky in the simulator, so turning a group back on rebuilds it
 * and reapplies the puff and the groups that are still quiet.
 */
export function createViewerSession(
  graph: SimGraph,
  groups: ReadonlyMap<string, Uint32Array>,
  seed = 1,
) {
  let currentSeed = seed;
  let sim: Simulator = createSim(graph, { seed: currentSeed });
  let clock = 0;
  /** Tick the settle after the last puff runs out on. */
  let settleUntil = 0;
  const drives = new Map<string, Drive>();
  const silenced = new Set<string>();
  const spikes = new Uint8Array(graph.neuronCount);

  function ids(colorGroup: string): Uint32Array {
    const found = groups.get(colorGroup);
    if (!found) throw new Error(`Unknown cell group ${colorGroup}`);
    return found;
  }

  function rebuild() {
    sim = createSim(graph, { seed: currentSeed });
    for (const colorGroup of silenced) sim.silence(ids(colorGroup));
    for (const [colorGroup, drive] of drives) {
      sim.stimulate(ids(colorGroup), drive.hz);
    }
  }

  function endDrives(finished: string[]) {
    for (const [colorGroup, drive] of drives) {
      if (drive.endTick > clock) continue;
      drives.delete(colorGroup);
      sim.stimulate(ids(colorGroup), 0);
      finished.push(colorGroup);
      settleUntil = Math.max(settleUntil, drive.endTick + ticksIn(SETTLE_MS));
    }
  }

  return {
    groups,
    get clock() {
      return clock;
    },
    get seed() {
      return currentSeed;
    },
    stimulate(colorGroup: string, hz: number, durationMs: number) {
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error("stimulus duration must be a positive number");
      }
      drives.set(colorGroup, { hz, endTick: clock + ticksIn(durationMs) });
      sim.stimulate(ids(colorGroup), hz);
    },
    setSilenced(colorGroup: string, on: boolean) {
      ids(colorGroup);
      const already = silenced.has(colorGroup);
      if (on === already) return;
      if (on) silenced.add(colorGroup);
      else silenced.delete(colorGroup);
      rebuild();
      // The rebuilt brain is at rest, so nothing is left to settle.
      settleUntil = clock;
    },
    /**
     * Run whole ticks. A puff that ends inside the span stops on its own tick.
     * `keep` adds this span's spikes to the last result instead of clearing it.
     */
    advance(ticks: number, keep = false): StepResult {
      if (!Number.isInteger(ticks) || ticks < 0) {
        throw new Error("ticks must be a whole number >= 0");
      }
      if (!keep) spikes.fill(0);
      const finished: string[] = [];
      const target = clock + ticks;
      while (clock < target) {
        let stop = target;
        for (const drive of drives.values()) {
          if (drive.endTick > clock && drive.endTick < stop) {
            stop = drive.endTick;
          }
        }
        sim.step(((stop - clock) * TICK_US) / 1000);
        const out = sim.spikes();
        for (let index = 0; index < out.length; index++) {
          if (out[index]) spikes[index] = 1;
        }
        clock = stop;
        endDrives(finished);
      }
      return { spikes, finished };
    },
    step(dtMs: number): StepResult {
      return this.advance(Math.round((dtMs * 1000) / TICK_US));
    },
    /** Clears puffs and silence and starts the clock again, on a new seed if given. */
    reset(nextSeed?: number) {
      if (nextSeed !== undefined) currentSeed = nextSeed;
      drives.clear();
      silenced.clear();
      clock = 0;
      settleUntil = 0;
      spikes.fill(0);
      rebuild();
    },
    hasDrive() {
      return drives.size > 0;
    },
    /** A puff is on, or the last one is still settling. The viewer steps only then. */
    running() {
      return drives.size > 0 || clock < settleUntil;
    },
  };
}

export type ViewerSession = ReturnType<typeof createViewerSession>;
