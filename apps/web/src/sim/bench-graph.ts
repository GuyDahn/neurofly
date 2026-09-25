import type { SimGraph } from "./graph.js";

/**
 * Fixed workload for the phone bench. Five thousand neurons, sparse signed
 * edges, a few hundred driven cells. Idle neurons stay at rest, which is the
 * same regime as the classroom subgraphs.
 */
export const BENCH = {
  neurons: 5000,
  degree: 16,
  driven: 250,
  hz: 30,
  seed: 1,
} as const;

/** Sparse signed graph. Most cells stay quiet, which is the classroom regime. */
export function benchGraph(
  neurons = BENCH.neurons,
  degree = BENCH.degree,
  seed = BENCH.seed,
): SimGraph {
  if (!Number.isInteger(neurons) || neurons < 1) {
    throw new Error("bench neuron count must be an integer >= 1");
  }
  if (!Number.isInteger(degree) || degree < 0) {
    throw new Error("bench degree must be an integer >= 0");
  }
  const edges = neurons * degree;
  const src = new Uint32Array(edges);
  const dst = new Uint32Array(edges);
  const weight = new Int16Array(edges);
  const ntSign = new Int8Array(edges);
  let at = 0;
  for (let i = 0; i < neurons; i++) {
    for (let k = 0; k < degree; k++) {
      const mix = hash(seed, i, k);
      let target = neurons <= 1 ? 0 : mix % (neurons - 1);
      if (target >= i) target += 1;
      src[at] = i;
      dst[at] = target;
      weight[at] = 1 + (mix % 3);
      ntSign[at] = mix % 5 === 0 ? -1 : 1;
      at += 1;
    }
  }
  return { neuronCount: neurons, src, dst, weight, ntSign };
}

function hash(seed: number, i: number, k: number): number {
  let x = Math.imul(seed ^ (i + 1), 0x9e3779b1) >>> 0;
  x = Math.imul(x ^ (k + 1), 0x85ebca6b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}
