import { flyMsAt, inLoop, wallMsAt, type Cascade } from "./cascade.js";

/**
 * Everything the landing page loop and the share image draw, in 2D canvas
 * pixels. Pure math, so the page, the Open Graph image, and the tests agree.
 */

type Vec3 = readonly [number, number, number];

/**
 * In front of the fly and to its right, dorsal side up (MaleCNS y grows
 * ventrally). The looming cells of both eyes sit top left and the giant fiber
 * runs down the neck into the nerve cord at the bottom right.
 */
export const VIEW: { direction: Vec3; up: Vec3 } = {
  direction: [0.7, 0.1, -0.7],
  up: [0, -1, 0],
};

/** A spike flashes at full brightness and fades out over this much wall time, as in the viewer. */
export const FLASH_MS = 150;
/** Flash window of the still frame, long enough to show the whole cascade at once. */
export const STILL_WINDOW_MS = 900;
/** Wall time a spike dot takes to run the length of its neuron. */
export const DOT_MS = 280;
/** Every lesson spike gets a dot on the few big cells, one in this many on the many looming cells. */
const LOOMING_DOT_EVERY = 6;

export type Scene = {
  cascade: Cascade;
  width: number;
  height: number;
  /** Canvas x, y of every path point, laid out like cascade.paths. */
  xy: Float32Array;
  /** Wall ms into the loop at which each spike lands. */
  spikeWall: Float32Array;
  /** Lesson group index per spike, or -1 for context cells. */
  spikeGroup: Int8Array;
};

/** Projects the cascade to fit a `width` x `height` canvas with `padding` on every side. */
export function buildScene(
  cascade: Cascade,
  width: number,
  height: number,
  padding = 0.06,
): Scene {
  const { data } = cascade.paths;
  const project = camera(cascade.frame.center, cascade.frame.radius);
  const raw = new Float32Array((data.length / 3) * 2);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let at = 0, out = 0; at < data.length; at += 3, out += 2) {
    const [x, y] = project(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0);
    raw[out] = x;
    raw[out + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min(
    (width * (1 - 2 * padding)) / spanX,
    (height * (1 - 2 * padding)) / spanY,
  );
  const left = (width - spanX * scale) / 2;
  const top = (height - spanY * scale) / 2;
  const xy = new Float32Array(raw.length);
  for (let at = 0; at < raw.length; at += 2) {
    xy[at] = left + ((raw[at] ?? 0) - minX) * scale;
    // Screen y grows downward.
    xy[at + 1] = top + (maxY - (raw[at + 1] ?? 0)) * scale;
  }
  const spikeWall = new Float32Array(cascade.spikeTick.length);
  const spikeGroup = new Int8Array(cascade.spikeTick.length);
  for (let index = 0; index < spikeWall.length; index++) {
    spikeWall[index] = wallMsAt(
      (cascade.spikeTick[index] ?? 0) * cascade.tickMs,
    );
    spikeGroup[index] =
      cascade.neuronGroup[cascade.spikeNeuron[index] ?? 0] ?? -1;
  }
  return { cascade, width, height, xy, spikeWall, spikeGroup };
}

/**
 * Flash level of every neuron at `wallMs` into the loop, 0 to 1. A neuron
 * that spiked `age` ms ago glows at 1 - age / window. A longer window makes a
 * still frame that shows the whole cascade at once.
 */
export function flashAt(
  scene: Scene,
  wallMs: number,
  out: Float32Array,
  windowMs = FLASH_MS,
): Float32Array {
  out.fill(0);
  const now = inLoop(wallMs);
  const { spikeWall } = scene;
  const neurons = scene.cascade.spikeNeuron;
  for (
    let index = firstAfter(spikeWall, now - windowMs);
    index < spikeWall.length;
    index++
  ) {
    const at = spikeWall[index] ?? 0;
    if (at > now) break;
    const level = 1 - (now - at) / windowMs;
    const neuron = neurons[index] ?? 0;
    if (level > (out[neuron] ?? 0)) out[neuron] = level;
  }
  return out;
}

export type Dot = {
  x: number;
  y: number;
  /** 0 as the dot leaves, 1 as it arrives. */
  progress: number;
  group: number;
};

/** Spike dots in flight at `wallMs`: each runs its neuron start to end. */
export function dotsAt(scene: Scene, wallMs: number): Dot[] {
  const now = inLoop(wallMs);
  const { spikeWall, spikeGroup, xy } = scene;
  const { offset } = scene.cascade.paths;
  const neurons = scene.cascade.spikeNeuron;
  const dots: Dot[] = [];
  for (
    let index = firstAfter(spikeWall, now - DOT_MS);
    index < spikeWall.length;
    index++
  ) {
    const at = spikeWall[index] ?? 0;
    if (at > now) break;
    const group = spikeGroup[index] ?? -1;
    if (group < 0 || (group === 0 && index % LOOMING_DOT_EVERY !== 0)) continue;
    const neuron = neurons[index] ?? 0;
    const start = (offset[neuron] ?? 0) / 3;
    const end = (offset[neuron + 1] ?? 0) / 3;
    const points = end - start;
    if (points < 2) continue;
    const progress = Math.min(1, (now - at) / DOT_MS);
    const scaled = progress * (points - 1);
    const index0 = Math.min(points - 1, Math.floor(scaled));
    const index1 = Math.min(points - 1, index0 + 1);
    const mix = scaled - index0;
    const a = (start + index0) * 2;
    const b = (start + index1) * 2;
    dots.push({
      x: (xy[a] ?? 0) + ((xy[b] ?? 0) - (xy[a] ?? 0)) * mix,
      y: (xy[a + 1] ?? 0) + ((xy[b + 1] ?? 0) - (xy[a + 1] ?? 0)) * mix,
      progress,
      group,
    });
  }
  return dots;
}

/** Fly ms the loop has reached at `wallMs`, or null before the swatter. */
export function flyClock(cascade: Cascade, wallMs: number): number | null {
  const fly = flyMsAt(wallMs, cascade);
  return fly < 0 ? null : fly;
}

/** The moment the still frame shows: every lesson group has fired, the last one just now. */
export function stillMoment(cascade: Cascade): number {
  let latest = 0;
  for (const group of cascade.groups) {
    if (group.firstTick !== null) latest = Math.max(latest, group.firstTick);
  }
  return wallMsAt(latest * cascade.tickMs) + FLASH_MS * 0.25;
}

/** Index of the first value strictly greater than `limit` in a sorted array. */
function firstAfter(sorted: Float32Array, limit: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((sorted[mid] ?? 0) > limit) high = mid;
    else low = mid + 1;
  }
  return low;
}

/** Perspective from VIEW, three framing radii out. Returns x right, y up, before fitting. */
function camera(
  center: Vec3,
  radius: number,
): (x: number, y: number, z: number) => [number, number] {
  const direction = normalize(VIEW.direction);
  const distance = radius * 3;
  const eye: Vec3 = [
    center[0] + direction[0] * distance,
    center[1] + direction[1] * distance,
    center[2] + direction[2] * distance,
  ];
  const forward = normalize([
    center[0] - eye[0],
    center[1] - eye[1],
    center[2] - eye[2],
  ]);
  const side = normalize(cross(forward, VIEW.up));
  const up = cross(side, forward);
  return (x, y, z) => {
    const rel: Vec3 = [x - eye[0], y - eye[1], z - eye[2]];
    const depth = Math.max(dot(rel, forward), 1e-6);
    return [dot(rel, side) / depth, dot(rel, up) / depth];
  };
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
