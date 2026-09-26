import { createSim } from "../sim/index.js";
import type { SimGraph, Simulator } from "../sim/index.js";

export type StepResult = {
  /** Valid until the next step() or reset(). This is the simulator's spikes() buffer. */
  spikes: Uint8Array;
  finished: string[];
};

type Drive = {
  hz: number;
  remainingMs: number;
};

/**
 * Classroom controls on a Day 2 simulator.
 * Silence is sticky in the simulator, so turning a group back on rebuilds it
 * and reapplies the puff and the groups that are still quiet.
 */
export function createViewerSession(
  graph: SimGraph,
  groups: ReadonlyMap<string, Uint32Array>,
  seed = 1,
) {
  let sim: Simulator = createSim(graph, { seed });
  const drives = new Map<string, Drive>();
  const silenced = new Set<string>();

  function ids(colorGroup: string): Uint32Array {
    const found = groups.get(colorGroup);
    if (!found) throw new Error(`Unknown cell group ${colorGroup}`);
    return found;
  }

  function rebuild() {
    sim = createSim(graph, { seed });
    for (const colorGroup of silenced) sim.silence(ids(colorGroup));
    for (const [colorGroup, drive] of drives) {
      sim.stimulate(ids(colorGroup), drive.hz);
    }
  }

  return {
    groups,
    stimulate(colorGroup: string, hz: number, durationMs: number) {
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error("stimulus duration must be a positive number");
      }
      drives.set(colorGroup, { hz, remainingMs: durationMs });
      sim.stimulate(ids(colorGroup), hz);
    },
    setSilenced(colorGroup: string, on: boolean) {
      ids(colorGroup);
      const already = silenced.has(colorGroup);
      if (on === already) return;
      if (on) silenced.add(colorGroup);
      else silenced.delete(colorGroup);
      rebuild();
    },
    step(dtMs: number): StepResult {
      sim.step(dtMs);
      const finished: string[] = [];
      for (const [colorGroup, drive] of drives) {
        drive.remainingMs -= dtMs;
        if (drive.remainingMs <= 0) finished.push(colorGroup);
      }
      for (const colorGroup of finished) {
        drives.delete(colorGroup);
        sim.stimulate(ids(colorGroup), 0);
      }
      return { spikes: sim.spikes(), finished };
    },
    reset() {
      drives.clear();
      silenced.clear();
      rebuild();
    },
    hasDrive() {
      return drives.size > 0;
    },
  };
}

export type ViewerSession = ReturnType<typeof createViewerSession>;
