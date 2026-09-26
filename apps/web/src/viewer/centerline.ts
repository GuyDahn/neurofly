export type NeuronPaths = {
  data: Float32Array;
  /** Prefix sum of float offsets. Length is neuronCount + 1. */
  offset: Uint32Array;
};

const BINS = 12;

/**
 * A short polyline through a tube cloud, along its longest axis.
 * Draco reorders ring vertices, so the sweep axis is the path we can recover.
 */
export function centerline(
  positions: ArrayLike<number>,
  bins = BINS,
): Float32Array {
  const count = Math.floor(positions.length / 3);
  if (count === 0 || bins < 1) return new Float32Array();
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < count; index++) {
    const x = positions[index * 3] ?? 0;
    const y = positions[index * 3 + 1] ?? 0;
    const z = positions[index * 3 + 2] ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const spanZ = maxZ - minZ;
  let axis = 0;
  let span = spanX;
  if (spanY > span) {
    axis = 1;
    span = spanY;
  }
  if (spanZ > span) {
    axis = 2;
    span = spanZ;
  }
  if (span < 1e-3) {
    return new Float32Array([
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ]);
  }
  const origin = axis === 0 ? minX : axis === 1 ? minY : minZ;
  const sum = new Float64Array(bins * 3);
  const hits = new Uint32Array(bins);
  for (let index = 0; index < count; index++) {
    const x = positions[index * 3] ?? 0;
    const y = positions[index * 3 + 1] ?? 0;
    const z = positions[index * 3 + 2] ?? 0;
    const coord = axis === 0 ? x : axis === 1 ? y : z;
    let bin = Math.floor(((coord - origin) / span) * bins);
    if (bin < 0) bin = 0;
    if (bin >= bins) bin = bins - 1;
    const at = bin * 3;
    sum[at] = (sum[at] ?? 0) + x;
    sum[at + 1] = (sum[at + 1] ?? 0) + y;
    sum[at + 2] = (sum[at + 2] ?? 0) + z;
    hits[bin] = (hits[bin] ?? 0) + 1;
  }
  let points = 0;
  for (let bin = 0; bin < bins; bin++) if ((hits[bin] ?? 0) > 0) points += 1;
  const out = new Float32Array(points * 3);
  let cursor = 0;
  for (let bin = 0; bin < bins; bin++) {
    const hitsInBin = hits[bin] ?? 0;
    if (hitsInBin === 0) continue;
    const at = bin * 3;
    out[cursor] = (sum[at] ?? 0) / hitsInBin;
    out[cursor + 1] = (sum[at + 1] ?? 0) / hitsInBin;
    out[cursor + 2] = (sum[at + 2] ?? 0) / hitsInBin;
    cursor += 3;
  }
  return out;
}

export function packPaths(
  parts: readonly (Float32Array | null | undefined)[],
): NeuronPaths {
  const offset = new Uint32Array(parts.length + 1);
  let total = 0;
  for (let index = 0; index < parts.length; index++) {
    offset[index] = total;
    const part = parts[index];
    if (part && part.length >= 6) total += part.length;
  }
  offset[parts.length] = total;
  const data = new Float32Array(total);
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const start = offset[index] ?? 0;
    if (part && part.length >= 6 && (offset[index + 1] ?? start) !== start) {
      data.set(part, start);
    }
  }
  return { data, offset };
}

export function samplePath(
  paths: NeuronPaths,
  neuron: number,
  t: number,
): [number, number, number] | null {
  const start = paths.offset[neuron];
  const end = paths.offset[neuron + 1];
  if (start === undefined || end === undefined || end - start < 6) return null;
  const points = (end - start) / 3;
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (points - 1);
  const index = Math.min(points - 1, Math.floor(scaled));
  const next = Math.min(points - 1, index + 1);
  const mix = scaled - index;
  const a = start + index * 3;
  const b = start + next * 3;
  const data = paths.data;
  const ax = data[a] ?? 0;
  const ay = data[a + 1] ?? 0;
  const az = data[a + 2] ?? 0;
  return [
    ax + ((data[b] ?? 0) - ax) * mix,
    ay + ((data[b + 1] ?? 0) - ay) * mix,
    az + ((data[b + 2] ?? 0) - az) * mix,
  ];
}
