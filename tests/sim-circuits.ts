import type { SimGraph } from "../apps/web/src/sim/graph.js";

/**
 * Small stand-ins for the Day 1 olfactory and escape subgraphs.
 * Synapse counts are chosen so Shiu's 0.275 mV per synapse crosses threshold
 * only on the paths the biology tests care about.
 */

const PN_COUNT = 40;
const KC_COUNT = 250;
const TUNED_KC = 20;
const ODOR_PN = 16;
const PN_PER_KC = 8;
const PN_KC_SYNAPSES = 18;
const KC_APL_SYNAPSES = 12;
const APL_KC_SYNAPSES = 120;
const KC_MBON_SYNAPSES = 40;
const MBON_COUNT = 6;
const READOUT_COUNT = 3;
const MBON_READOUT_SYNAPSES = 80;

const INPUT_COUNT = 16;
const DESCENDING_COUNT = 10;
const INPUT_GF_SYNAPSES = 20;
const GF_DESCENDING_SYNAPSES = 400;

export type OlfactoryFixture = {
  graph: SimGraph;
  odorPn: number[];
  kc: number[];
  tunedKc: number[];
  apl: number;
  mbon: number[];
  readout: number[];
};

export type EscapeFixture = {
  graph: SimGraph;
  inputs: number[];
  gf: number;
  descending: number[];
};

export function olfactoryCircuit(aplSign: 1 | -1 = -1): OlfactoryFixture {
  const odorPn = range(0, ODOR_PN);
  const kcStart = PN_COUNT;
  const kc = range(kcStart, KC_COUNT);
  const tunedKc = range(kcStart, TUNED_KC);
  const apl = kcStart + KC_COUNT;
  const mbonStart = apl + 1;
  const mbon = range(mbonStart, MBON_COUNT);
  const readout = range(mbonStart + MBON_COUNT, READOUT_COUNT);
  const neuronCount = readout[readout.length - 1]! + 1;
  const edges = new EdgeList();

  for (let t = 0; t < TUNED_KC; t++) {
    const cell = kcStart + t;
    for (let k = 0; k < PN_PER_KC; k++) {
      edges.add((t + k) % ODOR_PN, cell, PN_KC_SYNAPSES, 1);
    }
  }
  for (let t = TUNED_KC; t < KC_COUNT; t++) {
    const cell = kcStart + t;
    for (let k = 0; k < PN_PER_KC; k++) {
      edges.add(
        ODOR_PN + ((t + k) % (PN_COUNT - ODOR_PN)),
        cell,
        PN_KC_SYNAPSES,
        1,
      );
    }
  }
  for (const cell of kc) {
    edges.add(cell, apl, KC_APL_SYNAPSES, 1);
    edges.add(apl, cell, APL_KC_SYNAPSES, aplSign);
  }
  for (const cell of tunedKc) {
    for (const output of mbon) edges.add(cell, output, KC_MBON_SYNAPSES, 1);
  }
  for (const output of mbon) {
    for (const target of readout)
      edges.add(output, target, MBON_READOUT_SYNAPSES, 1);
  }

  return {
    graph: edges.graph(neuronCount),
    odorPn,
    kc,
    tunedKc,
    apl,
    mbon,
    readout,
  };
}

export function escapeCircuit(): EscapeFixture {
  const inputs = range(0, INPUT_COUNT);
  const gf = INPUT_COUNT;
  const descending = range(gf + 1, DESCENDING_COUNT);
  const edges = new EdgeList();
  for (const input of inputs) edges.add(input, gf, INPUT_GF_SYNAPSES, 1);
  for (const target of descending)
    edges.add(gf, target, GF_DESCENDING_SYNAPSES, 1);
  return {
    graph: edges.graph(descending[descending.length - 1]! + 1),
    inputs,
    gf,
    descending,
  };
}

export function pairGraph(
  ntSign: number,
  synapses: number,
  neurons = 2,
): SimGraph {
  return {
    neuronCount: neurons,
    src: Uint32Array.of(0),
    dst: Uint32Array.of(1),
    weight: Int16Array.of(synapses),
    ntSign: Int8Array.of(ntSign),
  };
}

class EdgeList {
  private readonly src: number[] = [];
  private readonly dst: number[] = [];
  private readonly weight: number[] = [];
  private readonly ntSign: number[] = [];

  add(src: number, dst: number, weight: number, ntSign: number) {
    this.src.push(src);
    this.dst.push(dst);
    this.weight.push(weight);
    this.ntSign.push(ntSign);
  }

  graph(neuronCount: number): SimGraph {
    return {
      neuronCount,
      src: Uint32Array.from(this.src),
      dst: Uint32Array.from(this.dst),
      weight: Int16Array.from(this.weight),
      ntSign: Int8Array.from(this.ntSign),
    };
  }
}

function range(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => start + index);
}
