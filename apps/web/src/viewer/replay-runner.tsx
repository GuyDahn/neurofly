"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { enqueue } from "./commands.js";
import { useCircuitCopy } from "./copy.js";
import type { LessonEntry } from "./modules.js";
import { PanelCredit, PanelTranslateNotice } from "./module-runner.js";
import { Controls, FOCUS_RING } from "./panel.js";
import { startPlayback, stopPlayback } from "./recorder.js";
import type { Replay, ReplayCommand } from "./replay.js";
import { Sheet, type SheetState } from "./sheet.js";
import { useViewerStore } from "./store.js";
import { Toolbar } from "./toolbar.js";

const BUTTON = `min-h-12 flex-1 rounded-xl px-4 text-base font-semibold transition-colors ${FOCUS_RING}`;

/**
 * Plays a shared run on its seed, press by press. The controls show each
 * press as it lands and open for free play once the run is over.
 */
export function ReplayRunner({
  entry,
  replay,
  onExit,
  credit,
}: {
  entry: LessonEntry;
  replay: Replay;
  /** Leaves the replay for the lesson. */
  onExit: () => void;
  /** Site credit at the very end of the panel. */
  credit?: ReactNode;
}) {
  const { module } = entry;
  const t = useTranslations("viewer.replay");
  const title = useTranslations("lessons")(`${entry.id}.title`);
  const format = useFormatter();
  const circuit = useCircuitCopy(module);
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
      label={t("label", { title })}
      footer={
        done ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRun((value) => value + 1)}
              className={`${BUTTON} border border-border-strong text-fg-muted hover:bg-overlay`}
            >
              {t("watchAgain")}
            </button>
            <button
              type="button"
              onClick={onExit}
              className={`${BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
            >
              {t("start")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-1" aria-live="polite">
            <p className="flex items-center gap-2 text-base font-semibold text-fg">
              <span aria-hidden="true" className="md:hidden">
                ↑
              </span>
              <span
                aria-hidden="true"
                className="hidden md:inline rtl:-scale-x-100"
              >
                →
              </span>
              {t("replaying")}
            </p>
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={replay.actions.length}
              aria-valuenow={applied}
              className="h-1.5 overflow-hidden rounded-full bg-overlay-strong"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{
                  width: `${replay.actions.length ? (applied / replay.actions.length) * 100 : 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-fg-subtle tabular-nums">
              {t("pressOf", {
                number: Math.min(applied, replay.actions.length),
                total: replay.actions.length,
              })}
            </p>
          </div>
        )
      }
    >
      <PanelTranslateNotice />
      <Toolbar entry={entry} />
      <section
        aria-label={t("section")}
        className="flex flex-col gap-3 rounded-2xl bg-overlay-strong p-4"
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
          {done ? t("finished") : t("section")}
        </p>
        <p className="text-lg leading-snug text-fg">
          {done ? t("over") : t("shared", { title })}
        </p>
        <ol className="flex flex-col gap-1.5 text-sm">
          {replay.actions.map((action, index) => (
            <li
              key={index}
              className={`flex items-baseline gap-2 ${index < applied ? "text-fg-muted" : "text-fg-subtle"}`}
            >
              <span className="w-5 shrink-0 text-end tabular-nums">
                {format.number(index + 1)}
              </span>
              <span className="flex-1">
                {t(pressKey(action.command), {
                  name: circuit.name(action.command.colorGroup),
                })}
              </span>
              <span className="shrink-0 text-xs text-fg-subtle tabular-nums">
                {t("tick", {
                  ms: format.number(action.tick / 10, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Controls module={module} readOnly={!done} />
      <PanelCredit>{credit}</PanelCredit>
    </Sheet>
  );
}

/** Which message names a press: stimulate, silence, or switch on. */
function pressKey(
  command: ReplayCommand,
): "stimulate" | "silence" | "switchOn" {
  if (command.type === "stimulate") return "stimulate";
  return command.on ? "silence" : "switchOn";
}
