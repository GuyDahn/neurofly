/** Counter-based unit interval in (0, 1]. Same seed, neuron, step, and draw replay. */
export function unitInterval(
  seed: number,
  neuron: number,
  step: number,
  draw: number,
): number {
  let x = seed >>> 0;
  x = Math.imul(x ^ (neuron + 1), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (step + 1), 0xc2b2ae35) >>> 0;
  x = Math.imul(x ^ (draw + 1), 0x27d4eb2f) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return (x + 1) / 4294967297;
}
