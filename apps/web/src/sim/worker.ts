import {
  createSimHost,
  type SimInMessage,
  type SimOutMessage,
} from "./host.js";

/** Subset of DedicatedWorkerGlobalScope. The DOM lib types `self` as window. */
type WorkerScope = {
  onmessage: ((event: MessageEvent<SimInMessage>) => void) | null;
  postMessage(message: SimOutMessage): void;
};

const ctx = self as unknown as WorkerScope;

const host = createSimHost((message) => {
  ctx.postMessage(message);
});

ctx.onmessage = (event: MessageEvent<SimInMessage>) => {
  try {
    host.onMessage(event.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.postMessage({ type: "error", message });
  }
};
