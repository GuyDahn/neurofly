import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BENCH,
  SHIU,
  benchGraph,
  createSim,
  createSimHost,
  encodeGraphBin,
  parseGraphBin,
  type SimInMessage,
  type SimOutMessage,
  type Simulator,
} from "../apps/web/src/sim/index.js";
import { escapeCircuit, olfactoryCircuit, pairGraph } from "./sim-circuits.js";

const ODOR_HZ = 100;
const ODOR_MS = 400;

describe("Shiu parameters", () => {
  it("keeps the published membrane, synapse, and weight constants", () => {
    assert.equal(SHIU.restMv, -52);
    assert.equal(SHIU.resetMv, -52);
    assert.equal(SHIU.thresholdMv, -45);
    assert.equal(SHIU.tauMembraneMs, 20);
    assert.equal(SHIU.tauSynapseMs, 5);
    assert.equal(SHIU.refractoryMs, 2.2);
    assert.equal(SHIU.delayMs, 1.8);
    assert.equal(SHIU.wSynMv, 0.275);
    assert.equal(SHIU.poissonGain, 250);
  });
});

describe("graph.bin", () => {
  it("round-trips the Day 1 NFLY layout and clamps synapse counts to int16", () => {
    const encoded = encodeGraphBin({
      neuronCount: 2,
      src: [0],
      dst: [1],
      weight: [40000],
      ntSign: [-1],
    });
    const bytes = new Uint8Array(encoded);
    assert.equal(bytes.length, 36);
    assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x4e, 0x46, 0x4c, 0x59]);
    const view = new DataView(encoded);
    assert.equal(view.getUint16(4, true), 1);
    assert.equal(view.getUint32(8, true), 2);
    assert.equal(view.getUint32(12, true), 1);
    assert.equal(view.getUint32(16, true), 12);
    assert.equal(view.getUint32(24, true), 0);
    assert.equal(view.getUint32(28, true), 1);
    assert.equal(view.getInt16(32, true), 32767);
    assert.equal(view.getInt8(34), -1);

    const graph = parseGraphBin(encoded);
    assert.equal(graph.neuronCount, 2);
    assert.equal(graph.weight[0], 32767);
    assert.equal(graph.ntSign[0], -1);
  });

  it("rejects a bad magic, a short file, and an edge past the table", () => {
    assert.throws(() => parseGraphBin(new ArrayBuffer(24)), /NFLY/);
    const good = encodeGraphBin(pairGraph(1, 1));
    const short = good.slice(0, 30);
    assert.throws(() => parseGraphBin(short), /truncated/);
    const view = new DataView(good.slice(0));
    view.setUint32(24, 9, true);
    assert.throws(() => parseGraphBin(view.buffer), /outside/);
  });
});

describe("simulator", () => {
  it("replays exactly for a seed, including after reset", () => {
    const graph = pairGraph(1, 40, 4);
    const first = record(graph, 3, 50);
    const second = record(graph, 3, 50);
    assert.deepEqual(second, first);

    const sim = createSim(graph, { seed: 3 });
    sim.stimulate([0], 80);
    const before = collect(sim, 30);
    sim.reset();
    const after = collect(sim, 30);
    assert.deepEqual(after, before);
  });

  it("changes the spike train when the seed changes", () => {
    const graph = pairGraph(1, 1, 2);
    const a = record(graph, 1, 80);
    const b = record(graph, 2, 80);
    assert.notDeepEqual(a, b);
  });

  it("accumulates partial ticks so two half-steps match one step", () => {
    const graph = pairGraph(1, 30, 3);
    const split = createSim(graph, { seed: 5 });
    const whole = createSim(graph, { seed: 5 });
    split.stimulate([0], 60);
    whole.stimulate([0], 60);
    for (let i = 0; i < 25; i++) {
      split.step(0.05);
      split.step(0.05);
      whole.step(0.1);
    }
    assert.deepEqual(Array.from(split.rates()), Array.from(whole.rates()));
  });

  it("matches spike counts when one step is split into milliseconds", () => {
    const graph = pairGraph(1, 80, 3);
    const fine = createSim(graph, { seed: 9 });
    const coarse = createSim(graph, { seed: 9 });
    fine.stimulate([0], 70);
    coarse.stimulate([0], 70);
    for (let i = 0; i < 40; i++) fine.step(1);
    coarse.step(40);
    assert.deepEqual(Array.from(fine.rates()), Array.from(coarse.rates()));
  });

  it("uses the neurotransmitter sign on each edge", () => {
    const excited = totalSpikes(pairGraph(1, 80), 120);
    const inhibited = totalSpikes(pairGraph(-1, 80), 120);
    const unsigned = totalSpikes(pairGraph(0, 80), 120);
    assert.ok(excited > 0, `excitatory postsynaptic spikes ${excited}`);
    assert.equal(inhibited, 0);
    assert.equal(unsigned, 0);
  });

  it("holds a refractory period of at least 2.2 ms", () => {
    const sim = createSim(pairGraph(1, 6000), { seed: 1 });
    sim.stimulate([0], 400);
    const times: number[] = [];
    for (let tick = 0; tick < 2000; tick++) {
      sim.step(0.1);
      if (sim.spikes()[1] === 1) times.push(tick);
    }
    assert.ok(times.length >= 5, `postsynaptic spikes ${times.length}`);
    let minGap = Number.POSITIVE_INFINITY;
    for (let i = 1; i < times.length; i++) {
      minGap = Math.min(minGap, times[i]! - times[i - 1]!);
    }
    assert.ok(minGap * 0.1 >= 2.2 - 1e-9, `minimum gap ${minGap} ticks`);
    assert.ok(minGap * 0.1 <= 3, `refractory gap was ${minGap * 0.1} ms`);
  });

  it("delays the postsynaptic spike by at least 1.8 ms", () => {
    const sim = createSim(pairGraph(1, 6000, 6), { seed: 1 });
    sim.stimulate([0], 500);
    let firstPre = -1;
    let firstPost = -1;
    for (let tick = 0; tick < 800; tick++) {
      sim.step(0.1);
      const spikes = sim.spikes();
      if (firstPre < 0 && spikes[0] === 1) firstPre = tick;
      if (firstPost < 0 && spikes[1] === 1) firstPost = tick;
      if (firstPre >= 0 && firstPost >= 0) break;
    }
    assert.ok(firstPre >= 0, "presynaptic neuron never spiked");
    assert.ok(firstPost >= 0, "postsynaptic neuron never spiked");
    const gapMs = (firstPost - firstPre) * 0.1;
    assert.ok(gapMs >= 1.8 - 1e-9, `delay was ${gapMs} ms`);
    assert.ok(gapMs < 8, `delay was ${gapMs} ms`);
  });

  it("lets silence override a stimulus", () => {
    const sim = createSim(
      { neuronCount: 1, src: [], dst: [], weight: [], ntSign: [] },
      { seed: 1 },
    );
    sim.stimulate([0], 100);
    sim.silence([0]);
    sim.step(50);
    assert.equal(sim.rates()[0], 0);
    assert.equal(sim.spikes()[0], 0);
  });
});

describe("olfactory biology", () => {
  it("fires Kenyon cells sparsely when projection neurons are driven", () => {
    const circuit = olfactoryCircuit();
    const sim = createSim(circuit.graph, { seed: 1 });
    sim.stimulate(circuit.odorPn, ODOR_HZ);
    sim.step(ODOR_MS);
    const rates = sim.rates();
    const fraction = activeFraction(rates, circuit.kc);
    const tuned = activeFraction(rates, circuit.tunedKc);
    let untuned = 0;
    for (const id of circuit.kc) {
      if (!circuit.tunedKc.includes(id) && (rates[id] ?? 0) > 0) untuned += 1;
    }
    assert.ok(
      fraction > 0 && fraction < 0.1,
      `KC active fraction ${fraction.toFixed(3)} (tuned ${tuned.toFixed(3)})`,
    );
    assert.ok(tuned > 0.5, `tuned KC fraction ${tuned.toFixed(3)}`);
    assert.equal(untuned, 0, "untuned Kenyon cells spiked");
    assert.ok(
      (rates[circuit.odorPn[0]!] ?? 0) > 30,
      "odor PNs were not driven",
    );
  });

  it("needs an inhibitory APL sign to keep Kenyon cells sparse", () => {
    const flipped = olfactoryCircuit(1);
    const sim = createSim(flipped.graph, { seed: 1 });
    sim.stimulate(flipped.odorPn, ODOR_HZ);
    sim.step(ODOR_MS);
    const rates = sim.rates();
    let untuned = 0;
    for (const id of flipped.kc) {
      if (!flipped.tunedKc.includes(id) && (rates[id] ?? 0) > 0) untuned += 1;
    }
    assert.ok(
      untuned > 0,
      "excitatory APL did not recruit untuned Kenyon cells",
    );
  });

  it("changes MBON-side output when MBONs are silenced and leaves KC sparsity", () => {
    const circuit = olfactoryCircuit();
    const open = createSim(circuit.graph, { seed: 4 });
    const shut = createSim(circuit.graph, { seed: 4 });
    shut.silence(circuit.mbon);
    open.stimulate(circuit.odorPn, ODOR_HZ);
    shut.stimulate(circuit.odorPn, ODOR_HZ);

    let mbonOpen = 0;
    let mbonShut = 0;
    let readoutOpen = 0;
    let readoutShut = 0;
    for (let ms = 0; ms < ODOR_MS; ms++) {
      open.step(1);
      shut.step(1);
      const a = open.spikes();
      const b = shut.spikes();
      for (const id of circuit.kc) assert.equal(b[id], a[id]);
      for (const id of circuit.mbon) {
        mbonOpen += a[id] ?? 0;
        mbonShut += b[id] ?? 0;
      }
      for (const id of circuit.readout) {
        readoutOpen += a[id] ?? 0;
        readoutShut += b[id] ?? 0;
      }
    }
    assert.ok(mbonOpen > 0, "control MBONs never spiked");
    assert.equal(mbonShut, 0);
    assert.ok(readoutOpen > 0, "control readout never spiked");
    assert.equal(readoutShut, 0);
    assert.ok(activeFraction(open.rates(), circuit.kc) < 0.1);
  });
});

describe("escape biology", () => {
  it("drives the giant fiber from its inputs and stops descending spikes when the giant fiber is silenced", () => {
    const circuit = escapeCircuit();
    const open = createSim(circuit.graph, { seed: 1 });
    const shut = createSim(circuit.graph, { seed: 1 });
    open.stimulate(circuit.inputs, 100);
    shut.silence([circuit.gf]);
    shut.stimulate(circuit.inputs, 100);
    open.step(200);
    shut.step(200);

    const driven = open.rates();
    const quiet = shut.rates();
    assert.ok((driven[circuit.gf] ?? 0) > 0, "giant fiber did not spike");
    assert.ok(
      sumRates(driven, circuit.descending) > 0,
      "descending neurons did not spike",
    );
    assert.equal(quiet[circuit.gf], 0);
    assert.equal(sumRates(quiet, circuit.descending), 0);
    assert.ok(
      sumRates(quiet, circuit.inputs) > 0,
      "silencing the giant fiber stopped its inputs",
    );
  });
});

describe("worker host", () => {
  it("steps a graph and reports a 5,000-neuron burst", () => {
    const messages: SimOutMessage[] = [];
    const host = createSimHost((message) => messages.push(message));
    const graph = benchGraph();
    host.onMessage({ type: "init", graph, opts: { seed: BENCH.seed } });
    host.onMessage({
      type: "stimulate",
      ids: Uint32Array.from({ length: BENCH.driven }, (_, index) => index),
      hz: BENCH.hz,
    });
    const started = performance.now();
    host.onMessage({ type: "bench", frames: 60, dtMs: 1000 / 60 });
    const wall = performance.now() - started;
    assert.equal(messages[0]?.type, "ready");
    if (messages[0]?.type === "ready") {
      assert.equal(messages[0].neuronCount, 5000);
      assert.equal(messages[0].edgeCount, BENCH.neurons * BENCH.degree);
    }
    assert.equal(messages[1]?.type, "bench");
    if (messages[1]?.type === "bench") {
      assert.equal(messages[1].frames, 60);
      assert.ok(messages[1].wallMs > 0);
      assert.ok(Number.isFinite(messages[1].networkHz));
    }
    assert.ok(
      wall < 2500,
      `5,000 neurons / 60 frames took ${wall.toFixed(0)} ms`,
    );
  });

  it("rejects the WebGPU backend while the flag is off", () => {
    assert.throws(
      () => createSim(pairGraph(1, 1), { backend: "webgpu" }),
      /WebGPU backend is off/,
    );
  });

  it("rejects a step before init", () => {
    const host = createSimHost(() => undefined);
    const message: SimInMessage = { type: "step", dtMs: 1 };
    assert.throws(() => host.onMessage(message), /not initialized/);
  });
});

function record(
  graph: ReturnType<typeof pairGraph>,
  seed: number,
  steps: number,
): number[] {
  const sim = createSim(graph, { seed });
  sim.stimulate([0], 50);
  return collect(sim, steps);
}

function collect(sim: Simulator, steps: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    sim.step(1);
    out.push(sim.spikes()[0] ?? 0);
  }
  return out;
}

function totalSpikes(graph: ReturnType<typeof pairGraph>, ms: number): number {
  const sim = createSim(graph, { seed: 1 });
  sim.stimulate([0], 100);
  sim.step(ms);
  const seconds = ms / 1000;
  return Math.round((sim.rates()[1] ?? 0) * seconds);
}

function activeFraction(rates: Float32Array, ids: number[]): number {
  let active = 0;
  for (const id of ids) if ((rates[id] ?? 0) > 0) active += 1;
  return active / ids.length;
}

function sumRates(rates: Float32Array, ids: number[]): number {
  let sum = 0;
  for (const id of ids) sum += rates[id] ?? 0;
  return sum;
}
