"use client";

import { useEffect, useState } from "react";
import { SIM_WEBGPU_ENABLED } from "@/src/sim/backend";
import { BENCH, benchGraph } from "@/src/sim/bench-graph";
import type { SimOutMessage } from "@/src/sim/host";

const FRAME_MS = 1000 / 60;
const BURST_FRAMES = 60;

type LoadedCircuit = {
  label: string;
  drive: number[];
  hz: number;
  init:
    | { type: "init"; graph: ReturnType<typeof benchGraph> }
    | { type: "init-bin"; buffer: ArrayBuffer };
};

export function Bench() {
  const [text, setText] = useState("starting");

  useEffect(() => {
    let stopped = false;
    let mode: "boot" | "burst" | "live" = "boot";
    let last = 0;
    const view = {
      circuit: "circuit          …",
      driven: "driven           …",
      neurons: "…",
      edges: "…",
      burst: "worker burst     measuring",
      fps: "…",
      frame: "…",
      hz: "…",
    };

    const paint = () => {
      if (stopped) return;
      setText(
        [
          view.circuit,
          view.driven,
          "backend          worker",
          `webgpu           ${SIM_WEBGPU_ENABLED ? "on" : "off"}`,
          `neurons          ${view.neurons}`,
          `edges            ${view.edges}`,
          view.burst,
          `live fps         ${view.fps}`,
          `live frame       ${view.frame} ms`,
          `spikes/sec       ${view.hz}`,
        ].join("\n"),
      );
    };

    let worker: Worker;
    try {
      worker = new Worker(new URL("../../src/sim/worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setText(`worker failed to start\n${message}`);
      return;
    }

    worker.onerror = () => {
      if (!stopped) setText("worker failed to start");
    };

    worker.onmessage = (event: MessageEvent<SimOutMessage>) => {
      if (stopped) return;
      const message = event.data;
      if (message.type === "error") {
        setText(message.message);
        return;
      }
      if (message.type === "ready") {
        view.neurons = String(message.neuronCount);
        view.edges = String(message.edgeCount);
        mode = "burst";
        paint();
        worker.postMessage({
          type: "bench",
          frames: BURST_FRAMES,
          dtMs: FRAME_MS,
        });
        return;
      }
      if (message.type === "bench") {
        const budget = message.frames * FRAME_MS;
        const holds = message.wallMs <= budget;
        view.burst = `worker burst     ${message.wallMs.toFixed(0)} ms for ${message.frames} frames (${holds ? "holds 60 fps" : "misses 60 fps"})`;
        view.hz = String(Math.round(message.networkHz));
        worker.postMessage({ type: "reset" });
        mode = "live";
        last = performance.now();
        paint();
        worker.postMessage({ type: "step", dtMs: FRAME_MS });
        return;
      }
      if (message.type === "stepped" && mode === "live") {
        const now = performance.now();
        const frame = now - last;
        last = now;
        view.fps = frame > 0 ? (1000 / frame).toFixed(0) : "…";
        view.frame = frame.toFixed(1);
        view.hz = String(Math.round(message.networkHz));
        paint();
        requestAnimationFrame(() => {
          if (!stopped) worker.postMessage({ type: "step", dtMs: FRAME_MS });
        });
      }
    };

    void (async () => {
      const loaded = await loadCircuit();
      if (stopped) return;
      view.circuit = loaded.label;
      view.driven = `driven           ${loaded.drive.length} neurons at ${loaded.hz} Hz`;
      paint();
      if (loaded.init.type === "init") {
        worker.postMessage({
          type: "init",
          graph: loaded.init.graph,
          opts: { seed: BENCH.seed, backend: "cpu" },
        });
      } else {
        worker.postMessage({
          type: "init-bin",
          buffer: loaded.init.buffer,
          opts: { seed: BENCH.seed, backend: "cpu" },
        });
      }
      worker.postMessage({
        type: "stimulate",
        ids: loaded.drive,
        hz: loaded.hz,
      });
    })();

    return () => {
      stopped = true;
      worker.terminate();
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 bg-white px-5 py-8 text-neutral-900">
      <h1 className="text-xl font-semibold tracking-tight">Simulator bench</h1>
      <p className="text-neutral-700">
        Leaky integrate-and-fire in a worker. Spikes per second is the whole
        network, averaged since the last reset.
      </p>
      <pre className="text-lg leading-8 tabular-nums">{text}</pre>
    </main>
  );
}

async function loadCircuit(): Promise<LoadedCircuit> {
  try {
    const [binRes, jsonRes] = await Promise.all([
      fetch("/data/olfactory.graph.bin"),
      fetch("/data/olfactory.neurons.json"),
    ]);
    if (binRes.ok && jsonRes.ok) {
      const buffer = await binRes.arrayBuffer();
      const payload: unknown = await jsonRes.json();
      const drive = projectionNeuronIds(payload);
      if (drive && drive.length > 0) {
        return {
          label: "circuit          olfactory",
          drive,
          hz: BENCH.hz,
          init: { type: "init-bin", buffer },
        };
      }
    }
  } catch {
    // The baked subgraph is optional. The synthetic network is the bench.
  }
  return {
    label: "circuit          synthetic 5,000",
    drive: Array.from({ length: BENCH.driven }, (_, index) => index),
    hz: BENCH.hz,
    init: { type: "init", graph: benchGraph() },
  };
}

function projectionNeuronIds(payload: unknown): number[] | null {
  if (!payload || typeof payload !== "object" || !("neurons" in payload)) {
    return null;
  }
  const neurons = (payload as { neurons?: unknown }).neurons;
  if (!Array.isArray(neurons)) return null;
  const ids: number[] = [];
  for (let index = 0; index < neurons.length; index++) {
    const neuron = neurons[index];
    if (
      neuron &&
      typeof neuron === "object" &&
      "colorGroup" in neuron &&
      (neuron as { colorGroup?: unknown }).colorGroup === "pn"
    ) {
      ids.push(index);
    }
  }
  return ids;
}
