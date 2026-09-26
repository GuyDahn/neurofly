"use client";

import { useCallback, useEffect, useState } from "react";
import { enqueue } from "./commands.js";
import type { LessonEntry } from "./modules.js";
import { Controls, FOCUS_RING } from "./panel.js";
import { startPlayback, stopPlayback } from "./recorder.js";
import type { Replay, ReplayCommand } from "./replay.js";
import { Sheet, type SheetState } from "./sheet.js";
import { useViewerStore } from "./store.js";
import { Toolbar } from "./toolbar.js";
import type { ModuleSpec } from "./types.js";

const BUTTON = `min-h-12 flex-1 rounded-xl px-4 text-base font-semibold transition-colors ${FOCUS_RING}`;

/**
 * Plays a shared run on its seed, press by press. The controls show each
 * press as it lands and open for free play once the run is over.
 */
export function ReplayRunner({
  entry,
  replay,
  onExit,
}: {
  entry: LessonEntry;
  replay: Replay;
  /** Leaves the replay for the lesson. */
  onExit: () => void;
}) {
  const { module, lesson } = entry;
  const [sheet, setSheet] = useState<SheetState>("min");
  const [run, setRun] = useState(0);
  const playback = useViewerStore((state) => state.playback);
  const live = useViewerStore((state) => state.circuit === module.id);
  const done = playback?.done === true;

  const play = useCallback(() => {
    useViewerStore.getState().resetControls();
    useViewerStore.getState().setFocus([]);
    enqueue({ type: "reset", seed: replay.seed });
    startPlayback(replay);
    useViewerStore.getState().setPlayback({
      applied: 0,
      total: replay.actions.length,
      done: replay.actions.length === 0,
    });
    setSheet("min");
  }, [replay]);

  // Start on this lesson's own circuit, never on the one still unloading.
  useEffect(() => {
    if (!live) return;
    play();
    return () => {
      stopPlayback();
      useViewerStore.getState().setPlayback(null);
    };
  }, [live, play, run]);

  useEffect(() => {
    if (done) setSheet("peek");
  }, [done]);

  const applied = playback?.applied ?? 0;
  return (
    <Sheet
      state={sheet}
      onState={setSheet}
      label={`Replay of ${lesson.title}`}
      footer={
        done ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRun((value) => value + 1)}
              className={`${BUTTON} border border-white/20 text-zinc-100 hover:bg-white/5`}
            >
              Watch again
            </button>
            <button
              type="button"
              onClick={onExit}
              className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
            >
              Start the lesson
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-1" aria-live="polite">
            <p className="flex items-center gap-2 text-base font-semibold text-zinc-50">
              <span aria-hidden="true" className="md:hidden">
                ↑
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                →
              </span>
              Replaying a shared run
            </p>
            <div
              role="progressbar"
              aria-label="Replay progress"
              aria-valuemin={0}
              aria-valuemax={replay.actions.length}
              aria-valuenow={applied}
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-zinc-50 transition-[width] duration-300"
                style={{
                  width: `${replay.actions.length ? (applied / replay.actions.length) * 100 : 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-zinc-400 tabular-nums">
              Press {Math.min(applied, replay.actions.length)} of{" "}
              {replay.actions.length}, on the same ticks and seed
            </p>
          </div>
        )
      }
    >
      <Toolbar entry={entry} />
      <section
        aria-label="Replay"
        className="flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
          {done ? "Replay finished" : "Replay"}
        </p>
        <p className="text-lg leading-snug text-zinc-50">
          {done
            ? "That was the whole run. Every button works now, so try your own."
            : `Someone shared their run of “${lesson.title}”. Watch it happen again, spike for spike.`}
        </p>
        <ol className="flex flex-col gap-1.5 text-sm">
          {replay.actions.map((action, index) => (
            <li
              key={index}
              className={`flex items-baseline gap-2 ${index < applied ? "text-zinc-200" : "text-zinc-500"}`}
            >
              <span className="w-5 shrink-0 text-right tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1">{describe(module, action.command)}</span>
              <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                {(action.tick / 10).toFixed(1)} ms
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Controls module={module} readOnly={!done} />
    </Sheet>
  );
}

function describe(module: ModuleSpec, command: ReplayCommand): string {
  const list = command.type === "stimulate" ? module.stimuli : module.silence;
  const name =
    list.find((item) => item.colorGroup === command.colorGroup)?.name ??
    command.colorGroup;
  if (command.type === "stimulate") return `Stimulate ${name}`;
  return command.on ? `Silence ${name}` : `Switch on ${name}`;
}
