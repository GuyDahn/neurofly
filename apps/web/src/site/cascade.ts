import type { NeuronPaths } from "../viewer/centerline.js";

/**
 * The landing page loop: the escape lesson's first swatter, baked from the
 * real escape circuit by scripts/bake-cascade.ts. Neuron shapes are the
 * centerlines the viewer draws, and the spikes are the simulator's own, on
 * the lesson's seed.
 */

export const CASCADE_FORMAT = 1;
/** Written next to the fetched circuit files, so it is never in git. */
export const CASCADE_FILE = "escape-cascade.json";

export type CascadeGroup = {
  colorGroup: string;
  label: string;
  color: string;
  /** Neurons in the group. */
  count: number;
  /** Tick of the group's first spike after the swatter, or null if it stayed dark. */
  firstTick: number | null;
};

type Vec3 = [number, number, number];

/** Shared by the file and the decoded cascade. */
type CascadeMeta = {
  dataset: string;
  license: string;
  citation: string;
  /** Lesson whose first step this replays. */
  lesson: string;
  seed: number;
  stimulus: { colorGroup: string; hz: number; ms: number };
  tickMs: number;
  /** Ticks simulated: the puff and the settle after it. */
  ticks: number;
  groups: CascadeGroup[];
  /** Bounding sphere of the lesson groups, the part the camera frames. */
  frame: { center: Vec3; radius: number };
};

/**
 * What the bake writes. Coordinates and spike ticks are small delta-coded
 * integers so the JSON compresses well.
 */
export type CascadeFile = CascadeMeta & {
  format: typeof CASCADE_FORMAT;
  origin: Vec3;
  /** World units per quantization step. */
  step: number;
  /** Lesson group index per neuron, or -1 for context cells. */
  group: number[];
  /** Points per neuron. 0 for a neuron with no drawable shape. */
  sizes: number[];
  /** Quantized x, y, z of every point, each coded as the change from the point before. */
  points: number[];
  /** Spikes in the lesson groups, sorted by tick. Ticks are coded as the change from the spike before. */
  spikes: { neuron: number[]; tick: number[] };
};

export type Cascade = CascadeMeta & {
  neuronGroup: Int8Array;
  paths: NeuronPaths;
  spikeNeuron: Uint32Array;
  spikeTick: Uint32Array;
};

export type CascadeInput = CascadeMeta & {
  /** Lesson group index per neuron, or -1. */
  neuronGroup: ArrayLike<number>;
  /** World-space polyline per neuron, or null. */
  paths: readonly (Float32Array | null)[];
  /** Spikes as [neuron, tick], in any order. */
  spikes: readonly (readonly [number, number])[];
  /** Quantization steps across the widest side of the circuit. */
  resolution?: number;
};

const DEFAULT_RESOLUTION = 4096;

export function encodeCascade(input: CascadeInput): CascadeFile {
  if (input.neuronGroup.length !== input.paths.length) {
    throw new Error("cascade needs one group entry per neuron");
  }
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const path of input.paths) {
    if (!path) continue;
    for (let at = 0; at < path.length; at += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = path[at + axis] ?? 0;
        if (value < min[axis]!) min[axis] = value;
        if (value > max[axis]!) max[axis] = value;
      }
    }
  }
  if (!Number.isFinite(min[0])) throw new Error("cascade has no neuron shapes");
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  // Quantize against the rounded values the file stores, so decoding is exact.
  const origin = min.map(round3) as Vec3;
  const step = round6(
    Math.max(span, 1e-3) / (input.resolution ?? DEFAULT_RESOLUTION),
  );
  const sizes: number[] = [];
  const points: number[] = [];
  const last = [0, 0, 0];
  for (const path of input.paths) {
    const count = path && path.length >= 6 ? path.length / 3 : 0;
    sizes.push(count);
    for (let point = 0; point < count; point++) {
      for (let axis = 0; axis < 3; axis++) {
        const value = path![point * 3 + axis] ?? 0;
        const q = Math.round((value - origin[axis]!) / step);
        points.push(q - last[axis]!);
        last[axis] = q;
      }
    }
  }
  const spikes = [...input.spikes].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const neuron: number[] = [];
  const tick: number[] = [];
  let previous = 0;
  for (const [cell, at] of spikes) {
    if (cell < 0 || cell >= input.paths.length) {
      throw new Error(
        `cascade spike names neuron ${cell}, outside the circuit`,
      );
    }
    neuron.push(cell);
    tick.push(at - previous);
    previous = at;
  }
  return {
    format: CASCADE_FORMAT,
    dataset: input.dataset,
    license: input.license,
    citation: input.citation,
    lesson: input.lesson,
    seed: input.seed,
    stimulus: input.stimulus,
    tickMs: input.tickMs,
    ticks: input.ticks,
    groups: input.groups,
    frame: {
      center: input.frame.center.map(round3) as Vec3,
      radius: round3(input.frame.radius),
    },
    origin,
    step,
    group: Array.from(input.neuronGroup),
    sizes,
    points,
    spikes: { neuron, tick },
  };
}

export function readCascade(value: unknown): Cascade {
  const file = value as Partial<CascadeFile> | null;
  if (!file || typeof file !== "object" || file.format !== CASCADE_FORMAT) {
    throw new Error("The escape loop file is missing or from another version.");
  }
  const { group, sizes, points, spikes, origin, step } = file;
  if (
    !Array.isArray(group) ||
    !Array.isArray(sizes) ||
    !Array.isArray(points) ||
    !Array.isArray(origin) ||
    typeof step !== "number" ||
    !spikes ||
    !Array.isArray(spikes.neuron) ||
    !Array.isArray(spikes.tick) ||
    spikes.neuron.length !== spikes.tick.length ||
    group.length !== sizes.length ||
    !Array.isArray(file.groups) ||
    !file.frame ||
    typeof file.ticks !== "number" ||
    typeof file.tickMs !== "number"
  ) {
    throw new Error("The escape loop file is damaged.");
  }
  const neurons = group.length;
  let total = 0;
  for (const size of sizes) total += size;
  if (total * 3 !== points.length) {
    throw new Error("The escape loop file is damaged.");
  }
  const offset = new Uint32Array(neurons + 1);
  const data = new Float32Array(total * 3);
  const q = [0, 0, 0];
  let at = 0;
  for (let neuron = 0; neuron < neurons; neuron++) {
    offset[neuron] = at;
    const count = sizes[neuron] ?? 0;
    for (let point = 0; point < count; point++) {
      for (let axis = 0; axis < 3; axis++) {
        q[axis]! += points[at] ?? 0;
        data[at] = (origin[axis] ?? 0) + q[axis]! * step;
        at += 1;
      }
    }
  }
  offset[neurons] = at;
  const spikeNeuron = Uint32Array.from(spikes.neuron);
  const spikeTick = new Uint32Array(spikes.tick.length);
  let tick = 0;
  for (let index = 0; index < spikeTick.length; index++) {
    tick += spikes.tick[index] ?? 0;
    spikeTick[index] = tick;
    if ((spikeNeuron[index] ?? neurons) >= neurons) {
      throw new Error("The escape loop file is damaged.");
    }
  }
  return {
    dataset: String(file.dataset ?? ""),
    license: String(file.license ?? ""),
    citation: String(file.citation ?? ""),
    lesson: String(file.lesson ?? ""),
    seed: Number(file.seed ?? 0),
    stimulus: file.stimulus ?? { colorGroup: "", hz: 0, ms: 0 },
    tickMs: file.tickMs,
    ticks: file.ticks,
    groups: file.groups,
    frame: file.frame,
    neuronGroup: Int8Array.from(group),
    paths: { data, offset },
    spikeNeuron,
    spikeTick,
  };
}

/** Fly time the bake records after the swatter appears. */
export const CASCADE_SPAN_MS = 64;
/** One pass of the loop, in wall-clock ms. */
export const LOOP_MS = 8000;
/** The brain at rest before the swatter. */
export const LEAD_MS = 700;
/**
 * Fly ms per wall ms: 100 times slower than life, so the 13 ms from the eyes
 * to the legs takes a little over a second.
 */
export const FLY_MS_PER_WALL_MS = 0.01;
/** The end of the run fades out over this much wall time. */
export const FADE_MS = 800;

type Run = Pick<Cascade, "ticks" | "tickMs">;

/**
 * Fly time at `wallMs` into the loop: negative during the lead-in, then
 * counting up and holding at the end of the run until the loop restarts.
 */
export function flyMsAt(wallMs: number, cascade: Run): number {
  const fly = (inLoop(wallMs) - LEAD_MS) * FLY_MS_PER_WALL_MS;
  return Math.min(fly, cascade.ticks * cascade.tickMs);
}

/** Wall ms into the loop when fly time reaches `flyMs`. */
export function wallMsAt(flyMs: number): number {
  return LEAD_MS + flyMs / FLY_MS_PER_WALL_MS;
}

/** How bright the activity draws at `wallMs`: 1, fading to 0 as the run ends, then 0 until the loop restarts. */
export function fadeAt(wallMs: number, cascade: Run): number {
  const end = wallMsAt(cascade.ticks * cascade.tickMs);
  const left = end - inLoop(wallMs);
  if (left <= 0) return 0;
  return Math.min(1, left / FADE_MS);
}

/** `wallMs` folded into one pass of the loop. */
export function inLoop(wallMs: number): number {
  return ((wallMs % LOOP_MS) + LOOP_MS) % LOOP_MS;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
