import { SIM_WEBGPU_ENABLED } from "./backend.js";
import type { SimGraph } from "./graph.js";
import { MAX_STIMULUS_HZ, SHIU, TICK_MS, TICK_US } from "./params.js";
import { unitInterval } from "./rng.js";

export type SimOptions = {
  /** Replay seed. The same seed and calls reproduce the same spikes. */
  seed?: number;
  /** Millivolts per anatomical synapse. Defaults to Shiu's 0.275 mV. */
  wSyn?: number;
  /**
   * "cpu" is the typed-array stepper (also what the worker runs).
   * "webgpu" is rejected while SIM_WEBGPU_ENABLED is false.
   */
  backend?: "cpu" | "webgpu";
};

export type Simulator = {
  /**
   * Drive these neurons with Poisson input at `hz`, as optogenetic activation.
   * Pass 0 to clear the drive. Ids are neuron indices. Each call restarts the
   * random stream for those neurons, so a puff on a resting network repeats
   * exactly whenever it starts.
   */
  stimulate(ids: ArrayLike<number>, hz: number): void;
  /**
   * Clamp these neurons at rest. They emit no spikes and do not drive anyone,
   * which is Shiu's removal of outgoing synapses plus a quiet spike record.
   */
  silence(ids: ArrayLike<number>): void;
  /** Advance `dtMs` of model time. Spikes from the whole call are OR-ed. */
  step(dtMs: number): void;
  /** 1 if the neuron spiked during the last step(). Valid until the next step or reset. */
  spikes(): Uint8Array;
  /** Spikes per second since reset (or since create). Valid until the next rates() call. */
  rates(): Float32Array;
  /**
   * Membrane, spike history, and the random stream return to t = 0.
   * Stimulus rates and the silence mask stay, so a replay repeats the same experiment.
   */
  reset(): void;
};

const DELAY_TICKS = exactTicks(SHIU.delayMs);
const REFRACTORY_TICKS = exactTicks(SHIU.refractoryMs);
/** Spikes are stamped at the end of a tick, so the hold is one tick shorter than the gap. */
const REFRACTORY_SKIP = REFRACTORY_TICKS - 1;
const RING = DELAY_TICKS + 1;

const REST = SHIU.restMv;
const RESET = SHIU.resetMv;
const THRESHOLD = SHIU.thresholdMv;
const EXP_M = Math.exp(-TICK_MS / SHIU.tauMembraneMs);
const EXP_S = Math.exp(-TICK_MS / SHIU.tauSynapseMs);
const G_COEF =
  (EXP_S - EXP_M) *
  (SHIU.tauSynapseMs / (SHIU.tauSynapseMs - SHIU.tauMembraneMs));

/** Conductance or voltage this close to rest is idle and can leave the live set. */
const FLUSH = 1e-4;

/**
 * Leaky integrate-and-fire on a Day 1 subgraph.
 *
 * dv/dt = (g - (v - V_rest)) / tau_m
 * dg/dt = -g / tau_syn
 * A presynaptic spike adds sign * count * W_syn to g after the axonal delay.
 * A spike resets v and g, then holds them for the refractory period.
 * Integration between events is the exact linear step, so replays do not
 * depend on Math.exp inside the loop.
 */
export function createSim(graph: SimGraph, opts: SimOptions = {}): Simulator {
  if (opts.backend === "webgpu" && !SIM_WEBGPU_ENABLED) {
    throw new Error(
      "WebGPU backend is off. Enable it only if the worker misses 60 fps at 5,000 neurons.",
    );
  }
  const seed = opts.seed === undefined ? 1 : opts.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("seed must be an integer from 0 to 2^32-1");
  }
  const wSyn = opts.wSyn ?? SHIU.wSynMv;
  if (!Number.isFinite(wSyn) || wSyn < 0) {
    throw new Error("wSyn must be a finite number >= 0");
  }

  const n = graph.neuronCount;
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("neuronCount must be an integer >= 0");
  }
  const edges = graph.src.length;
  if (
    graph.dst.length !== edges ||
    graph.weight.length !== edges ||
    graph.ntSign.length !== edges
  ) {
    throw new Error("graph edge arrays must have the same length");
  }

  const { ptr, post, weightMv } = buildOutgoing(graph, wSyn);
  const kick = wSyn * SHIU.poissonGain;

  const v = new Float64Array(n);
  const g = new Float64Array(n);
  const refracLeft = new Uint16Array(n);
  const spikeCounts = new Uint32Array(n);
  const outSpikes = new Uint8Array(n);
  const ratesBuf = new Float32Array(n);
  const silenced = new Uint8Array(n);
  const stimHz = new Float64Array(n);
  const stimLimit = new Float64Array(n);
  const stimOn = new Uint8Array(n);
  const stimIds = new Uint32Array(n);
  /** Tick each drive started. Draws count from here, so a puff repeats whenever it starts. */
  const stimStart = new Float64Array(n);
  let stimCount = 0;

  const liveFlag = new Uint8Array(n);
  const liveIds = new Uint32Array(n);
  let liveCount = 0;

  const fired = new Uint32Array(n);
  const ringCount = new Uint32Array(RING);
  const ringIds = new Uint32Array(RING * n);

  let pendingUs = 0;
  let elapsedUs = 0;
  let stepIndex = 0;

  v.fill(REST);

  function wake(i: number) {
    if (liveFlag[i] === 0) {
      liveFlag[i] = 1;
      liveIds[liveCount] = i;
      liveCount += 1;
    }
  }

  function assertIds(ids: ArrayLike<number>) {
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k] ?? Number.NaN;
      if (!Number.isInteger(id) || id < 0 || id >= n) {
        throw new Error(`Neuron id ${String(id)} is outside 0..${n - 1}`);
      }
    }
  }

  function clearStimulus(id: number) {
    stimHz[id] = 0;
    stimLimit[id] = 0;
    if (stimOn[id] === 0) return;
    stimOn[id] = 0;
    for (let k = 0; k < stimCount; k++) {
      if (stimIds[k] === id) {
        stimCount -= 1;
        stimIds[k] = stimIds[stimCount] ?? 0;
        return;
      }
    }
  }

  function stimulate(ids: ArrayLike<number>, hz: number) {
    if (!Number.isFinite(hz) || hz < 0 || hz > MAX_STIMULUS_HZ) {
      throw new Error(
        `stimulus rate must be between 0 and ${MAX_STIMULUS_HZ} Hz`,
      );
    }
    assertIds(ids);
    const limit = hz === 0 ? 0 : Math.exp((-hz * TICK_US) / 1e6);
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k] ?? 0;
      if (hz === 0) {
        clearStimulus(id);
        continue;
      }
      stimHz[id] = hz;
      stimLimit[id] = limit;
      stimStart[id] = stepIndex;
      if (silenced[id] === 0) wake(id);
      if (stimOn[id] === 0) {
        stimOn[id] = 1;
        stimIds[stimCount] = id;
        stimCount += 1;
      }
    }
  }

  function silence(ids: ArrayLike<number>) {
    assertIds(ids);
    for (let k = 0; k < ids.length; k++) {
      const id = ids[k] ?? 0;
      silenced[id] = 1;
      v[id] = REST;
      g[id] = 0;
      refracLeft[id] = 0;
    }
  }

  function deliver(step: number) {
    const slot = step % RING;
    const count = ringCount[slot] ?? 0;
    const base = slot * n;
    for (let k = 0; k < count; k++) {
      const pre = ringIds[base + k] ?? 0;
      if (silenced[pre] === 1) continue;
      const start = ptr[pre] ?? 0;
      const end = ptr[pre + 1] ?? 0;
      for (let e = start; e < end; e++) {
        const target = post[e] ?? 0;
        if (silenced[target] === 1) continue;
        const add = weightMv[e] ?? 0;
        if (add === 0) continue;
        g[target] = (g[target] ?? 0) + add;
        wake(target);
      }
    }
  }

  function integrate(): number {
    let firedCount = 0;
    for (let k = 0; k < liveCount; k++) {
      const i = liveIds[k] ?? 0;
      if (silenced[i] === 1) continue;
      if ((refracLeft[i] ?? 0) > 0) {
        refracLeft[i] = (refracLeft[i] ?? 0) - 1;
        continue;
      }
      const gi = g[i] ?? 0;
      const vi = v[i] ?? REST;
      if (gi !== 0 || vi !== REST) {
        let nextV = REST + (vi - REST) * EXP_M + gi * G_COEF;
        let nextG = gi * EXP_S;
        if (nextG > -FLUSH && nextG < FLUSH) nextG = 0;
        if (nextG === 0 && nextV > REST - FLUSH && nextV < REST + FLUSH) {
          nextV = REST;
        }
        g[i] = nextG;
        v[i] = nextV;
      }
      if ((v[i] ?? REST) > THRESHOLD) {
        fired[firedCount] = i;
        firedCount += 1;
        outSpikes[i] = 1;
        spikeCounts[i] = (spikeCounts[i] ?? 0) + 1;
      }
    }
    return firedCount;
  }

  function poisson(step: number) {
    for (let k = 0; k < stimCount; k++) {
      const i = stimIds[k] ?? 0;
      if (silenced[i] === 1 || stimHz[i] === 0) continue;
      const limit = stimLimit[i] ?? 1;
      const local = step - (stimStart[i] ?? 0);
      let count = 0;
      let p = 1;
      let draw = 1;
      do {
        count += 1;
        p *= unitInterval(seed, i, local, draw);
        draw += 1;
        if (count > 64) {
          throw new Error("Poisson draw did not terminate");
        }
      } while (p > limit);
      const events = count - 1;
      if (events > 0) v[i] = (v[i] ?? REST) + events * kick;
    }
  }

  function resetFired(firedCount: number) {
    for (let k = 0; k < firedCount; k++) {
      const i = fired[k] ?? 0;
      v[i] = RESET;
      g[i] = 0;
      refracLeft[i] = stimHz[i] > 0 ? 0 : REFRACTORY_SKIP;
    }
  }

  function storeRing(step: number, firedCount: number) {
    const slot = step % RING;
    ringCount[slot] = firedCount;
    const base = slot * n;
    for (let k = 0; k < firedCount; k++) ringIds[base + k] = fired[k] ?? 0;
  }

  function sleepSweep() {
    let k = 0;
    while (k < liveCount) {
      const i = liveIds[k] ?? 0;
      const idle =
        silenced[i] === 1 ||
        (stimHz[i] === 0 && refracLeft[i] === 0 && g[i] === 0 && v[i] === REST);
      if (idle) {
        liveFlag[i] = 0;
        liveCount -= 1;
        liveIds[k] = liveIds[liveCount] ?? 0;
      } else {
        k += 1;
      }
    }
  }

  function tick(step: number) {
    deliver(step);
    const firedCount = integrate();
    poisson(step);
    resetFired(firedCount);
    storeRing(step, firedCount);
    sleepSweep();
    elapsedUs += TICK_US;
  }

  function step(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new Error("dtMs must be a finite number >= 0");
    }
    outSpikes.fill(0);
    pendingUs += Math.round(dtMs * 1000);
    while (pendingUs >= TICK_US) {
      pendingUs -= TICK_US;
      tick(stepIndex);
      stepIndex += 1;
    }
  }

  function rates() {
    if (elapsedUs === 0) {
      ratesBuf.fill(0);
      return ratesBuf;
    }
    const scale = 1e6 / elapsedUs;
    for (let i = 0; i < n; i++) ratesBuf[i] = (spikeCounts[i] ?? 0) * scale;
    return ratesBuf;
  }

  function reset() {
    v.fill(REST);
    g.fill(0);
    refracLeft.fill(0);
    spikeCounts.fill(0);
    outSpikes.fill(0);
    ratesBuf.fill(0);
    ringCount.fill(0);
    liveFlag.fill(0);
    liveCount = 0;
    pendingUs = 0;
    elapsedUs = 0;
    stepIndex = 0;
    stimStart.fill(0);
    for (let k = 0; k < stimCount; k++) {
      const i = stimIds[k] ?? 0;
      if (stimOn[i] === 1 && stimHz[i] > 0 && silenced[i] === 0) wake(i);
    }
  }

  return { stimulate, silence, step, spikes: () => outSpikes, rates, reset };
}

function exactTicks(ms: number): number {
  const us = Math.round(ms * 1000);
  if (us % TICK_US !== 0) {
    throw new Error(`integration tick does not divide ${ms} ms`);
  }
  return us / TICK_US;
}

function buildOutgoing(
  graph: SimGraph,
  wSyn: number,
): { ptr: Uint32Array; post: Uint32Array; weightMv: Float64Array } {
  const n = graph.neuronCount;
  const edges = graph.src.length;
  const degree = new Uint32Array(n);
  for (let e = 0; e < edges; e++) {
    const pre = checkIndex(graph.src[e] ?? Number.NaN, n, e, "src");
    checkIndex(graph.dst[e] ?? Number.NaN, n, e, "dst");
    const syn = graph.weight[e] ?? Number.NaN;
    const sign = graph.ntSign[e] ?? Number.NaN;
    if (!Number.isFinite(syn) || syn < 0) {
      throw new Error(`edge ${e} has an invalid synapse count`);
    }
    if (!Number.isFinite(sign)) {
      throw new Error(`edge ${e} has an invalid neurotransmitter sign`);
    }
    degree[pre] = (degree[pre] ?? 0) + 1;
  }
  const ptr = new Uint32Array(n + 1);
  for (let i = 0; i < n; i++) ptr[i + 1] = (ptr[i] ?? 0) + (degree[i] ?? 0);
  const cursor = ptr.slice(0, n);
  const post = new Uint32Array(edges);
  const weightMv = new Float64Array(edges);
  for (let e = 0; e < edges; e++) {
    const pre = graph.src[e] ?? 0;
    const at = cursor[pre] ?? 0;
    cursor[pre] = at + 1;
    post[at] = graph.dst[e] ?? 0;
    weightMv[at] = (graph.ntSign[e] ?? 0) * (graph.weight[e] ?? 0) * wSyn;
  }
  return { ptr, post, weightMv };
}

function checkIndex(
  index: number,
  n: number,
  edge: number,
  label: string,
): number {
  if (!Number.isInteger(index) || index < 0 || index >= n) {
    throw new Error(
      `edge ${edge} ${label} ${String(index)} is outside the neuron table`,
    );
  }
  return index;
}
