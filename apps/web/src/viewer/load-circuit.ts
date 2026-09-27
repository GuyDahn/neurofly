import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector3,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { centerline, packPaths, type NeuronPaths } from "./centerline.js";
import { CompassReadout, compassWedges } from "./compass.js";
import { FlashField } from "./flash.js";
import { dracoParts, readGlb, type GltfJson } from "./glb.js";
import { assignGroups, bodyIndex, type NeuronRow } from "./groups.js";
import { createFlashTexture, createNeuronMaterial } from "./materials.js";
import { emptyGroups } from "./module.js";
import { parseGraphBin } from "../sim/index.js";
import { createViewerSession, type ViewerSession } from "./session.js";
import type { ModuleSpec } from "./types.js";

export type LoadedCircuit = {
  session: ViewerSession;
  geometry: BufferGeometry;
  material: ReturnType<typeof createNeuronMaterial>;
  texture: ReturnType<typeof createFlashTexture>;
  flash: FlashField;
  /** One byte per neuron: 255 draws it at full color, 0 dims it. */
  focus: Uint8Array;
  focusTexture: ReturnType<typeof createFlashTexture>;
  paths: NeuronPaths;
  bounds: Box3;
  /** What the camera fits at the start: the module's frame groups, or everything. */
  frameBounds: Box3;
  /** Heading dial for circuits with a compass, else null. */
  compass: CompassReadout | null;
  dispose: () => void;
};

/** Cells no module group claims. Dim, so the lesson groups stand out. */
const CONTEXT_COLOR = "#52525b";

const progressListeners = new Set<(fraction: number) => void>();

export function watchLoadProgress(
  listener: (fraction: number) => void,
): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

function report(fraction: number) {
  const clamped = Math.min(1, Math.max(0, fraction));
  for (const listener of progressListeners) listener(clamped);
}

type Ticket = {
  promise: Promise<LoadedCircuit>;
  release: () => void;
};

let cached: { id: string; promise: Promise<LoadedCircuit> } | null = null;
let readers = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

export function openCircuit(module: ModuleSpec): Ticket {
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  readers += 1;
  if (!cached || cached.id !== module.id) {
    const pending = loadCircuit(module).catch((error: unknown) => {
      if (cached?.promise === pending) cached = null;
      throw error;
    });
    cached = { id: module.id, promise: pending };
  }
  const promise = cached.promise;
  return {
    promise,
    release() {
      readers = Math.max(0, readers - 1);
      if (readers > 0) return;
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        if (readers > 0) return;
        void promise.then(
          (model) => model.dispose(),
          () => undefined,
        );
        cached = null;
      }, 0);
    },
  };
}

export function loadError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("The ") ||
    message.startsWith("module.json") ||
    message.includes("graph.bin") ||
    message.includes("neuron")
  ) {
    return message;
  }
  return "The circuit did not load. Run pnpm data:fetch and refresh.";
}

async function loadCircuit(module: ModuleSpec): Promise<LoadedCircuit> {
  report(0.04);
  const [graphBuffer, neuronFile, glb] = await Promise.all([
    fetchBuffer(module.assets.graph),
    fetchJson(module.assets.neurons),
    fetchBuffer(module.assets.gltf),
  ]);
  await yieldToMain();
  report(0.2);
  const neurons = readNeurons(neuronFile, module.circuit);
  const graph = parseGraphBin(graphBuffer);
  if (graph.neuronCount !== neurons.length) {
    throw new Error("The wiring and the neuron list do not match.");
  }
  const assigned = assignGroups(neurons, module.groups);
  const absent = emptyGroups(module, assigned.groups);
  if (absent.length > 0) {
    throw new Error(`The circuit has no ${absent[0]} neurons.`);
  }
  const compass = module.compass
    ? new CompassReadout(compassWedges(module.compass, bodyIndex(neurons)))
    : null;
  const session = createViewerSession(graph, assigned.groups, module.seed);
  await yieldToMain();
  const built = await mergeLines(glb, neurons, assigned.member, module);
  const flash = new FlashField(graph.neuronCount);
  const texture = createFlashTexture(flash.bytes, graph.neuronCount);
  const focus = new Uint8Array(graph.neuronCount).fill(255);
  const focusTexture = createFlashTexture(focus, graph.neuronCount);
  const material = createNeuronMaterial(
    texture,
    focusTexture,
    graph.neuronCount,
  );
  report(1);
  return {
    session,
    geometry: built.geometry,
    material,
    texture,
    flash,
    focus,
    focusTexture,
    paths: built.paths,
    bounds: built.bounds,
    frameBounds:
      frameBounds(built.paths, assigned.groups, module.frame) ?? built.bounds,
    compass,
    dispose() {
      built.geometry.dispose();
      material.dispose();
      texture.dispose();
      focusTexture.dispose();
    },
  };
}

function frameBounds(
  paths: NeuronPaths,
  groups: ReadonlyMap<string, Uint32Array>,
  frame: readonly string[],
): Box3 | null {
  const box = new Box3();
  const point = new Vector3();
  for (const name of frame) {
    for (const neuron of groups.get(name) ?? []) {
      const start = paths.offset[neuron] ?? 0;
      const end = paths.offset[neuron + 1] ?? start;
      for (let at = start; at < end; at += 3) {
        point.set(
          paths.data[at] ?? 0,
          paths.data[at + 1] ?? 0,
          paths.data[at + 2] ?? 0,
        );
        box.expandByPoint(point);
      }
    }
  }
  return box.isEmpty() ? null : box;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetchOk(url);
  return response.arrayBuffer();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetchOk(url);
  return response.json() as Promise<unknown>;
}

/**
 * /data files are cached for a year, so each request names the data release
 * the build fetched. A new release is a new URL.
 */
export function versioned(url: string, version: string | undefined): string {
  if (!version) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${encodeURIComponent(version)}`;
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(
    versioned(url, process.env.NEXT_PUBLIC_DATA_VERSION),
  );
  if (!response.ok) {
    throw new Error(
      "The circuit files are not available. Run pnpm data:fetch and refresh.",
    );
  }
  return response;
}

function readNeurons(value: unknown, circuit: string): NeuronRow[] {
  if (!value || typeof value !== "object") {
    throw new Error("The neuron list is missing.");
  }
  const record = value as Record<string, unknown>;
  if (record.circuit !== circuit) {
    throw new Error("The neuron list is for a different circuit.");
  }
  if (!Array.isArray(record.neurons)) {
    throw new Error("The neuron list is missing.");
  }
  const rows: NeuronRow[] = [];
  for (const item of record.neurons) {
    if (!item || typeof item !== "object") {
      throw new Error("The neuron list has a gap.");
    }
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "number" || typeof row.colorGroup !== "string") {
      throw new Error("The neuron list is missing an id or a color group.");
    }
    rows.push({
      id: row.id,
      type: typeof row.type === "string" ? row.type : "",
      colorGroup: row.colorGroup,
    });
  }
  return rows;
}
const DECODE_BATCH = 12;

type DracoJob = {
  neuron: number;
  color: Color;
  bytes: ArrayBuffer;
  positionId: number;
};

async function mergeLines(
  glb: ArrayBuffer,
  neurons: NeuronRow[],
  member: Int16Array,
  module: ModuleSpec,
): Promise<{ geometry: BufferGeometry; paths: NeuronPaths; bounds: Box3 }> {
  const { json, bin } = readGlb(glb);
  await yieldToMain();
  const jobs = lineJobs(json, bin, neurons, member, module);
  if (jobs.length === 0) {
    throw new Error("The circuit model has no neurons to draw.");
  }
  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  draco.setWorkerLimit(2);
  draco.preload();
  const positions: number[] = [];
  const colors: number[] = [];
  const neuronIndex: number[] = [];
  const pathParts: (Float32Array | null)[] = new Array(neurons.length).fill(
    null,
  );
  const box = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  try {
    for (let start = 0; start < jobs.length; start += DECODE_BATCH) {
      const slice = jobs.slice(start, start + DECODE_BATCH);
      const geometries = await Promise.all(
        slice.map((job) => decodePosition(draco, job.bytes, job.positionId)),
      );
      for (let index = 0; index < slice.length; index++) {
        const job = slice[index];
        const geometry = geometries[index];
        if (!job || !geometry) continue;
        absorbLine(
          job,
          geometry,
          positions,
          colors,
          neuronIndex,
          pathParts,
          box,
        );
        geometry.dispose();
      }
      report(0.25 + 0.7 * ((start + slice.length) / jobs.length));
      await yieldToMain();
    }
  } finally {
    draco.dispose();
  }
  if (positions.length < 6) {
    throw new Error("The circuit model has no neurons to draw.");
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(Float32Array.from(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new Float32BufferAttribute(Float32Array.from(colors), 3),
  );
  geometry.setAttribute(
    "neuronIndex",
    new BufferAttribute(Float32Array.from(neuronIndex), 1),
  );
  geometry.computeBoundingSphere();
  return {
    geometry,
    paths: packPaths(pathParts),
    bounds: new Box3(
      new Vector3(box.min[0], box.min[1], box.min[2]),
      new Vector3(box.max[0], box.max[1], box.max[2]),
    ),
  };
}

function absorbLine(
  job: DracoJob,
  geometry: BufferGeometry,
  positions: number[],
  colors: number[],
  neuronIndex: number[],
  pathParts: (Float32Array | null)[],
  box: { min: number[]; max: number[] },
) {
  const position = geometry.getAttribute("position");
  if (!position || position.count < 2) return;
  const source = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    source[index * 3] = position.getX(index);
    source[index * 3 + 1] = position.getY(index);
    source[index * 3 + 2] = position.getZ(index);
  }
  const path = centerline(source);
  if (path.length < 6) return;
  pathParts[job.neuron] = path;
  const points = path.length / 3;
  for (let point = 0; point < points - 1; point++) {
    for (const end of [point, point + 1]) {
      const x = path[end * 3] ?? 0;
      const y = path[end * 3 + 1] ?? 0;
      const z = path[end * 3 + 2] ?? 0;
      positions.push(x, y, z);
      colors.push(job.color.r, job.color.g, job.color.b);
      neuronIndex.push(job.neuron);
      if (x < (box.min[0] ?? Infinity)) box.min[0] = x;
      if (y < (box.min[1] ?? Infinity)) box.min[1] = y;
      if (z < (box.min[2] ?? Infinity)) box.min[2] = z;
      if (x > (box.max[0] ?? -Infinity)) box.max[0] = x;
      if (y > (box.max[1] ?? -Infinity)) box.max[1] = y;
      if (z > (box.max[2] ?? -Infinity)) box.max[2] = z;
    }
  }
}

type DracoFileDecoder = {
  decodeDracoFile(
    buffer: ArrayBuffer,
    callback: (geometry: BufferGeometry) => void,
    attributeIDs: { position: number },
    attributeTypes: null,
    vertexColorSpace: undefined,
    onError: (error: unknown) => void,
  ): Promise<unknown>;
};

function decodePosition(
  draco: DRACOLoader,
  bytes: ArrayBuffer,
  positionId: number,
): Promise<BufferGeometry> {
  const decoder = draco as DRACOLoader & DracoFileDecoder;
  return new Promise((resolve, reject) => {
    decoder
      .decodeDracoFile(
        bytes,
        (geometry) => resolve(geometry),
        { position: positionId },
        null,
        undefined,
        () => reject(new Error("The circuit model could not be decoded.")),
      )
      .catch(reject);
  });
}

function lineJobs(
  json: GltfJson,
  bin: Uint8Array,
  neurons: NeuronRow[],
  member: Int16Array,
  module: ModuleSpec,
): DracoJob[] {
  const palette = module.groups.map((group) => new Color(group.color));
  const context = new Color(CONTEXT_COLOR);
  return dracoParts(json, bin, bodyIndex(neurons), neurons.length).map(
    (part) => ({
      ...part,
      color: palette[member[part.neuron] ?? -1] ?? context,
    }),
  );
}

function yieldToMain(): Promise<void> {
  const scheduler = (
    globalThis as { scheduler?: { yield?: () => Promise<void> } }
  ).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
