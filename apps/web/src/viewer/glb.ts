/**
 * The baked circuit glTF: one Draco-compressed tube mesh per neuron, named by
 * body id. The viewer and the landing page bake both read it through here, so
 * they pick the same mesh for each neuron.
 */

export type GltfJson = {
  nodes?: Array<{
    name?: string;
    mesh?: number;
    extras?: { bodyId?: unknown };
  }>;
  meshes?: Array<{
    primitives?: Array<{
      extensions?: {
        KHR_draco_mesh_compression?: {
          bufferView?: number;
          attributes?: { POSITION?: number };
        };
      };
    }>;
  }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength?: number }>;
};

export type DracoPart = {
  /** Index in the neuron list. */
  neuron: number;
  /** The Draco-compressed mesh, copied out of the binary chunk. */
  bytes: ArrayBuffer;
  /** Draco unique id of the POSITION attribute. */
  positionId: number;
};

export function readGlb(buffer: ArrayBuffer): {
  json: GltfJson;
  bin: Uint8Array;
} {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    throw new Error("The circuit model is not a glTF file.");
  }
  let offset = 12;
  const jsonLength = view.getUint32(offset, true);
  const jsonType = view.getUint32(offset + 4, true);
  offset += 8;
  if (jsonType !== 0x4e4f534a) {
    throw new Error("The circuit model is missing its description.");
  }
  const jsonBytes = new Uint8Array(buffer, offset, jsonLength);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes)) as GltfJson;
  offset += jsonLength;
  const binLength = view.getUint32(offset, true);
  offset += 8;
  return { json, bin: new Uint8Array(buffer, offset, binLength) };
}

/** The first Draco mesh for each neuron in `indexOfBody`, in file order. */
export function dracoParts(
  json: GltfJson,
  bin: Uint8Array,
  indexOfBody: ReadonlyMap<number, number>,
  neuronCount: number,
): DracoPart[] {
  const seen = new Uint8Array(neuronCount);
  const parts: DracoPart[] = [];
  for (const node of json.nodes ?? []) {
    if (typeof node.mesh !== "number") continue;
    const bodyId = asId(node.extras?.bodyId) ?? asId(node.name);
    if (bodyId === null) continue;
    const neuron = indexOfBody.get(bodyId);
    if (neuron === undefined || seen[neuron] === 1) continue;
    const primitive = json.meshes?.[node.mesh]?.primitives?.[0];
    const dracoExt = primitive?.extensions?.KHR_draco_mesh_compression;
    const bufferView = dracoExt?.bufferView;
    const positionId = dracoExt?.attributes?.POSITION;
    if (bufferView === undefined || positionId === undefined) continue;
    const bytes = bufferViewBytes(json, bin, bufferView);
    if (!bytes) continue;
    seen[neuron] = 1;
    parts.push({ neuron, bytes, positionId });
  }
  return parts;
}

function bufferViewBytes(
  json: GltfJson,
  bin: Uint8Array,
  index: number,
): ArrayBuffer | null {
  const view = json.bufferViews?.[index];
  if (!view || typeof view.byteLength !== "number") return null;
  const start = view.byteOffset ?? 0;
  const slice = bin.subarray(start, start + view.byteLength);
  const copy = new Uint8Array(slice.byteLength);
  copy.set(slice);
  return copy.buffer;
}

function asId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
