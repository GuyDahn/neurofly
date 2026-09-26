"use client";

import dynamic from "next/dynamic";
import { Panel } from "./panel.js";
import { useViewerStore } from "./store.js";
import type { ModuleSpec } from "./types.js";

const Scene = dynamic(() => import("./scene.js"), { ssr: false });

export function Viewer({ module }: { module: ModuleSpec }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100 scheme-dark md:flex-row">
      <Panel module={module} />
      <Stage module={module} />
    </div>
  );
}

function Stage({ module }: { module: ModuleSpec }) {
  const status = useViewerStore((state) => state.status);
  const error = useViewerStore((state) => state.error);
  const progress = useViewerStore((state) => state.progress);
  const percent = Math.round(progress * 100);

  return (
    <div className="relative order-1 min-h-0 flex-1 bg-zinc-950 md:order-2">
      <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
          Neurofly
        </p>
        <h1 className="max-w-md text-3xl font-semibold tracking-tight text-zinc-50">
          {module.title}
        </h1>
        <p className="mt-1 max-w-sm text-sm leading-snug text-zinc-300">
          {module.summary}
        </p>
      </header>
      <p className="sr-only">
        Three-dimensional view of the neurons. Drag to turn it. Pinch to zoom.
      </p>
      <div className="absolute inset-0 touch-none">
        <Scene module={module} />
      </div>
      {status === "loading" ? (
        <p className="pointer-events-none absolute right-4 bottom-3 left-4 text-center text-sm text-zinc-300">
          Loading the circuit{percent > 0 ? `… ${percent}%` : "…"}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="absolute right-4 bottom-3 left-4 rounded-xl bg-red-950/90 px-3 py-2 text-sm text-red-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
