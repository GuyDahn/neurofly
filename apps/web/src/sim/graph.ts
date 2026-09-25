/** Pruned subgraph. Indices are positions in the Day 1 neuron table, not body ids. */
export type SimGraph = {
  neuronCount: number;
  src: ArrayLike<number>;
  dst: ArrayLike<number>;
  /** Anatomical synapse counts. Neurotransmitter sign is separate. */
  weight: ArrayLike<number>;
  /** +1 excitatory, -1 inhibitory, 0 if the transmitter has no sign. */
  ntSign: ArrayLike<number>;
};

const HEADER_BYTES = 24;
const EDGE_BYTES = 12;
const WEIGHT_INT16_MAX = 32767;

export function parseGraphBin(buffer: ArrayBuffer | ArrayBufferView): SimGraph {
  const bytes = toBytes(buffer);
  if (bytes.byteLength < HEADER_BYTES) {
    throw new Error("graph.bin is shorter than the NFLY header");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes[0] !== 0x4e ||
    bytes[1] !== 0x46 ||
    bytes[2] !== 0x4c ||
    bytes[3] !== 0x59
  ) {
    throw new Error("graph.bin magic is not NFLY");
  }
  const version = view.getUint16(4, true);
  if (version !== 1) {
    throw new Error(`graph.bin version ${version} is not supported`);
  }
  const neuronCount = view.getUint32(8, true);
  const edgeCount = view.getUint32(12, true);
  const record = view.getUint32(16, true);
  if (record !== EDGE_BYTES) {
    throw new Error(
      `graph.bin edge record is ${record} bytes, expected ${EDGE_BYTES}`,
    );
  }
  const need = HEADER_BYTES + edgeCount * EDGE_BYTES;
  if (bytes.byteLength < need) {
    throw new Error("graph.bin is truncated");
  }

  const src = new Uint32Array(edgeCount);
  const dst = new Uint32Array(edgeCount);
  const weight = new Int16Array(edgeCount);
  const ntSign = new Int8Array(edgeCount);
  let offset = HEADER_BYTES;
  for (let i = 0; i < edgeCount; i++) {
    const pre = view.getUint32(offset, true);
    const post = view.getUint32(offset + 4, true);
    const syn = view.getInt16(offset + 8, true);
    const sign = view.getInt8(offset + 10);
    if (pre >= neuronCount || post >= neuronCount) {
      throw new Error(`graph.bin edge ${i} points outside the neuron table`);
    }
    if (syn < 0) {
      throw new Error(`graph.bin edge ${i} has a negative synapse count`);
    }
    src[i] = pre;
    dst[i] = post;
    weight[i] = syn;
    ntSign[i] = sign;
    offset += EDGE_BYTES;
  }
  return { neuronCount, src, dst, weight, ntSign };
}

/** Little-endian NFLY graph.bin. Synapse counts clamp to int16, matching Day 1. */
export function encodeGraphBin(graph: SimGraph): ArrayBuffer {
  const edges = graph.src.length;
  if (
    graph.dst.length !== edges ||
    graph.weight.length !== edges ||
    graph.ntSign.length !== edges
  ) {
    throw new Error("graph edge arrays must have the same length");
  }
  const buffer = new ArrayBuffer(HEADER_BYTES + edges * EDGE_BYTES);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  bytes[0] = 0x4e;
  bytes[1] = 0x46;
  bytes[2] = 0x4c;
  bytes[3] = 0x59;
  view.setUint16(4, 1, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, graph.neuronCount, true);
  view.setUint32(12, edges, true);
  view.setUint32(16, EDGE_BYTES, true);
  view.setUint32(20, 0, true);
  let offset = HEADER_BYTES;
  for (let i = 0; i < edges; i++) {
    const syn = graph.weight[i] ?? 0;
    if (!Number.isFinite(syn) || syn < 0) {
      throw new Error(`edge ${i} has an invalid synapse count`);
    }
    view.setUint32(offset, graph.src[i] ?? 0, true);
    view.setUint32(offset + 4, graph.dst[i] ?? 0, true);
    view.setInt16(offset + 8, Math.min(WEIGHT_INT16_MAX, syn), true);
    view.setInt8(offset + 10, graph.ntSign[i] ?? 0);
    view.setInt8(offset + 11, 0);
    offset += EDGE_BYTES;
  }
  return buffer;
}

function toBytes(buffer: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
