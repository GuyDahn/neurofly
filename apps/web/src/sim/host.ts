import { createSim, type SimOptions, type Simulator } from "./engine.js";
import { parseGraphBin, type SimGraph } from "./graph.js";

export type SimInMessage =
  | { type: "init"; graph: SimGraph; opts?: SimOptions }
  | { type: "init-bin"; buffer: ArrayBuffer; opts?: SimOptions }
  | { type: "stimulate"; ids: ArrayLike<number>; hz: number }
  | { type: "silence"; ids: ArrayLike<number> }
  | { type: "step"; dtMs: number }
  | { type: "reset" }
  | { type: "bench"; frames: number; dtMs: number };

export type SimOutMessage =
  | { type: "ready"; neuronCount: number; edgeCount: number }
  | { type: "stepped"; networkHz: number }
  | {
      type: "bench";
      wallMs: number;
      frames: number;
      networkHz: number;
    }
  | { type: "error"; message: string };

export function createSimHost(post: (message: SimOutMessage) => void) {
  let sim: Simulator | null = null;

  function requireSim(): Simulator {
    if (!sim) throw new Error("Simulator is not initialized");
    return sim;
  }

  return {
    onMessage(message: SimInMessage) {
      switch (message.type) {
        case "init": {
          sim = createSim(message.graph, message.opts);
          post({
            type: "ready",
            neuronCount: message.graph.neuronCount,
            edgeCount: message.graph.src.length,
          });
          return;
        }
        case "init-bin": {
          const graph = parseGraphBin(message.buffer);
          sim = createSim(graph, message.opts);
          post({
            type: "ready",
            neuronCount: graph.neuronCount,
            edgeCount: graph.src.length,
          });
          return;
        }
        case "stimulate":
          requireSim().stimulate(message.ids, message.hz);
          return;
        case "silence":
          requireSim().silence(message.ids);
          return;
        case "step": {
          const current = requireSim();
          current.step(message.dtMs);
          post({ type: "stepped", networkHz: networkHz(current) });
          return;
        }
        case "reset":
          requireSim().reset();
          return;
        case "bench": {
          const current = requireSim();
          const started = performance.now();
          for (let frame = 0; frame < message.frames; frame++) {
            current.step(message.dtMs);
          }
          post({
            type: "bench",
            wallMs: performance.now() - started,
            frames: message.frames,
            networkHz: networkHz(current),
          });
          return;
        }
        default: {
          const unknown: never = message;
          throw new Error(`Unknown simulator message ${String(unknown)}`);
        }
      }
    },
  };
}

function networkHz(sim: Simulator): number {
  const rates = sim.rates();
  let sum = 0;
  for (let i = 0; i < rates.length; i++) sum += rates[i] ?? 0;
  return sum;
}
