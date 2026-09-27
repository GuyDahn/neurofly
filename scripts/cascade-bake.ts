import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import draco3d, { type DecoderModule } from "draco3dgltf";
import {
  CASCADE_FILE,
  CASCADE_SPAN_MS,
  encodeCascade,
  type CascadeFile,
} from "../apps/web/src/site/cascade.js";
import { parseGraphBin } from "../apps/web/src/sim/index.js";
import { TICK_MS } from "../apps/web/src/sim/params.js";
import { centerline } from "../apps/web/src/viewer/centerline.js";
import { dracoParts, readGlb } from "../apps/web/src/viewer/glb.js";
import {
  assignGroups,
  bodyIndex,
  type NeuronRow,
} from "../apps/web/src/viewer/groups.js";
import { findLesson } from "../apps/web/src/viewer/modules.js";
import {
  createViewerSession,
  ticksIn,
} from "../apps/web/src/viewer/session.js";

type Point = [number, number, number];

/** Share of the non-lesson cells kept to outline the brain and nerve cord. */
const CONTEXT_SHARE = 0.35;
/**
 * Quantization steps across the circuit. About one step per pixel on a wide
 * landing page, and a small file.
 */
const RESOLUTION = 1024;

/** A fixed pick, the same on every bake: Knuth's multiplicative hash of the index. */
export function keepContext(neuron: number): boolean {
  return Math.imul(neuron + 1, 2654435761) >>> 0 < CONTEXT_SHARE * 2 ** 32;
}

/**
 * Bakes the landing page loop from the fetched escape circuit: every neuron's
 * centerline, as the viewer draws it, and the spikes of the escape lesson's
 * first step (one swatter on the lesson's seed) for the first
 * CASCADE_SPAN_MS of fly time. Writes escape-cascade.json next to the circuit
 * files and returns its path.
 */
export async function bakeCascade(dataDir: string): Promise<string> {
  const file = await buildCascade(dataDir);
  const dest = path.join(dataDir, CASCADE_FILE);
  const partial = `${dest}.partial`;
  await writeFile(partial, JSON.stringify(file));
  await rename(partial, dest);
  return dest;
}

/** The cascade file for the escape circuit in `dataDir`, without writing it. */
export async function buildCascade(dataDir: string): Promise<CascadeFile> {
  const entry = findLesson("escape");
  if (!entry) throw new Error("The escape lesson is missing.");
  const { module, lesson } = entry;
  const first = lesson.steps[0]?.goal;
  if (first?.type !== "stimulate") {
    throw new Error("The escape lesson no longer opens with a stimulus.");
  }
  const [glb, graphBytes, neuronText] = await Promise.all([
    readFile(path.join(dataDir, path.basename(module.assets.gltf))),
    readFile(path.join(dataDir, path.basename(module.assets.graph))),
    readFile(path.join(dataDir, path.basename(module.assets.neurons)), "utf8"),
  ]);
  const listed = readNeuronFile(JSON.parse(neuronText), module.circuit);
  const graph = parseGraphBin(graphBytes);
  if (graph.neuronCount !== listed.rows.length) {
    throw new Error("The escape wiring and neuron list do not match.");
  }
  const { groups, member } = assignGroups(listed.rows, module.groups);
  const paths = await decodeCenterlines(toArrayBuffer(glb), listed.rows);
  orientDownstream(
    paths,
    groups,
    module.groups.map((g) => g.colorGroup),
  );

  // Every lesson cell, and a fixed share of the rest to outline the brain.
  const kept: number[] = [];
  const slot = new Int32Array(listed.rows.length).fill(-1);
  for (let neuron = 0; neuron < listed.rows.length; neuron++) {
    if (!paths[neuron]) continue;
    if ((member[neuron] ?? -1) < 0 && !keepContext(neuron)) continue;
    slot[neuron] = kept.length;
    kept.push(neuron);
  }

  const session = createViewerSession(graph, groups, module.seed);
  session.stimulate(first.colorGroup, module.stimulusHz, module.stimulusMs);
  const spikes: [number, number][] = [];
  const firstTick = new Map<number, number>();
  const span = ticksIn(CASCADE_SPAN_MS);
  while (session.clock < span) {
    const { spikes: out } = session.advance(1);
    for (const neuron of kept) {
      if (!out[neuron]) continue;
      spikes.push([slot[neuron]!, session.clock]);
      const group = member[neuron] ?? -1;
      if (group >= 0 && !firstTick.has(group)) {
        firstTick.set(group, session.clock);
      }
    }
  }

  const file: CascadeFile = encodeCascade({
    dataset: listed.dataset,
    license: listed.license,
    citation: listed.citation,
    lesson: lesson.id,
    seed: module.seed,
    stimulus: {
      colorGroup: first.colorGroup,
      hz: module.stimulusHz,
      ms: module.stimulusMs,
    },
    tickMs: TICK_MS,
    ticks: session.clock,
    groups: module.groups.map((group, index) => ({
      colorGroup: group.colorGroup,
      color: group.color,
      count: groups.get(group.colorGroup)?.length ?? 0,
      firstTick: firstTick.get(index) ?? null,
    })),
    frame: frameSphere(paths, groups, module.frame),
    neuronGroup: kept.map((neuron) => member[neuron] ?? -1),
    paths: kept.map((neuron) => paths[neuron] ?? null),
    spikes,
    resolution: RESOLUTION,
  });
  return file;
}

function readNeuronFile(
  value: unknown,
  circuit: string,
): {
  rows: NeuronRow[];
  dataset: string;
  license: string;
  citation: string;
} {
  const record = value as Record<string, unknown> | null;
  if (!record || record.circuit !== circuit || !Array.isArray(record.neurons)) {
    throw new Error(`escape neuron list is not for the ${circuit} circuit`);
  }
  const rows = record.neurons.map((item: unknown) => {
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "number" || typeof row.colorGroup !== "string") {
      throw new Error("escape neuron list is missing an id or a color group");
    }
    return {
      id: row.id,
      type: typeof row.type === "string" ? row.type : "",
      colorGroup: row.colorGroup,
    };
  });
  return {
    rows,
    dataset: String(record.dataset ?? ""),
    license: String(record.license ?? ""),
    citation: String(record.citation ?? ""),
  };
}

async function decodeCenterlines(
  glb: ArrayBuffer,
  rows: NeuronRow[],
): Promise<(Float32Array | null)[]> {
  const { json, bin } = readGlb(glb);
  const decoder = await draco3d.createDecoderModule({});
  const paths: (Float32Array | null)[] = new Array(rows.length).fill(null);
  for (const part of dracoParts(json, bin, bodyIndex(rows), rows.length)) {
    const positions = decodePositions(decoder, part.bytes, part.positionId);
    const path = centerline(positions);
    // The viewer skips neurons whose centerline is a single point.
    if (path.length >= 6) paths[part.neuron] = path;
  }
  return paths;
}

function decodePositions(
  draco: DecoderModule,
  bytes: ArrayBuffer,
  positionId: number,
): Float32Array {
  const decoder = new draco.Decoder();
  const mesh = new draco.Mesh();
  try {
    const array = new Int8Array(bytes);
    const status = decoder.DecodeArrayToMesh(array, array.byteLength, mesh);
    if (!status.ok() || mesh.ptr === 0) {
      throw new Error(`Draco could not decode a neuron: ${status.error_msg()}`);
    }
    const attribute = decoder.GetAttributeByUniqueId(mesh, positionId);
    const values = mesh.num_points() * attribute.num_components();
    const byteLength = values * Float32Array.BYTES_PER_ELEMENT;
    const pointer = draco._malloc(byteLength);
    try {
      decoder.GetAttributeDataArrayForAllPoints(
        mesh,
        attribute,
        draco.DT_FLOAT32,
        byteLength,
        pointer,
      );
      return new Float32Array(draco.HEAPF32.buffer, pointer, values).slice();
    } finally {
      draco._free(pointer);
    }
  } finally {
    draco.destroy(mesh);
    draco.destroy(decoder);
  }
}

/**
 * A centerline runs along a neuron's longest axis in whichever direction the
 * mesh happens to sweep. Turn the lesson cells so they read in the order the
 * signal travels: looming cells end at the giant fiber, the giant fiber runs
 * from them down to the nerve cord, and the jump neurons start where it ends.
 * The loop sends its spike dots start to end.
 */
export function orientDownstream(
  paths: (Float32Array | null)[],
  groups: ReadonlyMap<string, Uint32Array>,
  order: readonly string[],
) {
  const [inputName, relayName, outputName] = order;
  const input = [...(groups.get(inputName ?? "") ?? [])];
  const relay = [...(groups.get(relayName ?? "") ?? [])];
  const output = [...(groups.get(outputName ?? "") ?? [])];
  const inputCenter = centroid(paths, input);
  if (!inputCenter) return;
  for (const neuron of relay) {
    const path = paths[neuron];
    if (
      path &&
      distance(end(path), inputCenter) < distance(start(path), inputCenter)
    ) {
      paths[neuron] = reversed(path);
    }
  }
  const relayStart = centroid(paths, relay, (path) => start(path));
  const relayEnd = centroid(paths, relay, (path) => end(path));
  if (!relayStart || !relayEnd) return;
  for (const neuron of input) {
    const path = paths[neuron];
    if (
      path &&
      distance(start(path), relayStart) < distance(end(path), relayStart)
    ) {
      paths[neuron] = reversed(path);
    }
  }
  for (const neuron of output) {
    const path = paths[neuron];
    if (
      path &&
      distance(end(path), relayEnd) < distance(start(path), relayEnd)
    ) {
      paths[neuron] = reversed(path);
    }
  }
}

/** The camera's framing sphere, as the viewer builds it from the frame groups. */
function frameSphere(
  paths: (Float32Array | null)[],
  groups: ReadonlyMap<string, Uint32Array>,
  frame: readonly string[],
): { center: Point; radius: number } {
  const min: Point = [Infinity, Infinity, Infinity];
  const max: Point = [-Infinity, -Infinity, -Infinity];
  const names = frame.length > 0 ? frame : [...groups.keys()];
  for (const name of names) {
    for (const neuron of groups.get(name) ?? []) {
      const path = paths[neuron];
      if (!path) continue;
      for (let at = 0; at < path.length; at += 3) {
        for (let axis = 0; axis < 3; axis++) {
          const value = path[at + axis] ?? 0;
          if (value < min[axis]!) min[axis] = value;
          if (value > max[axis]!) max[axis] = value;
        }
      }
    }
  }
  if (!Number.isFinite(min[0]))
    throw new Error("The escape groups have no shapes.");
  const center: Point = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  return { center, radius };
}

function centroid(
  paths: (Float32Array | null)[],
  neurons: readonly number[],
  pick?: (path: Float32Array) => Point,
): Point | null {
  const sum: Point = [0, 0, 0];
  let count = 0;
  for (const neuron of neurons) {
    const path = paths[neuron];
    if (!path) continue;
    const points = pick ? [pick(path)] : pointsOf(path);
    for (const point of points) {
      sum[0] += point[0];
      sum[1] += point[1];
      sum[2] += point[2];
      count += 1;
    }
  }
  return count === 0 ? null : [sum[0] / count, sum[1] / count, sum[2] / count];
}

function pointsOf(path: Float32Array): Point[] {
  const points: Point[] = [];
  for (let at = 0; at + 2 < path.length; at += 3) {
    points.push([path[at] ?? 0, path[at + 1] ?? 0, path[at + 2] ?? 0]);
  }
  return points;
}

function start(path: Float32Array): Point {
  return [path[0] ?? 0, path[1] ?? 0, path[2] ?? 0];
}

function end(path: Float32Array): Point {
  const at = path.length - 3;
  return [path[at] ?? 0, path[at + 1] ?? 0, path[at + 2] ?? 0];
}

function reversed(path: Float32Array): Float32Array {
  const out = new Float32Array(path.length);
  const points = path.length / 3;
  for (let point = 0; point < points; point++) {
    const from = (points - 1 - point) * 3;
    out[point * 3] = path[from] ?? 0;
    out[point * 3 + 1] = path[from + 1] ?? 0;
    out[point * 3 + 2] = path[from + 2] ?? 0;
  }
  return out;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
