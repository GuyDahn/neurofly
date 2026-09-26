"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enqueue } from "./commands.js";
import {
  controlState,
  focusFor,
  meetsGoal,
  type LessonModule,
  type LessonPhase,
} from "./lesson.js";
import { Panel } from "./panel.js";
import { useViewerStore } from "./store.js";
import type { ControlAction, ControlGate, ModuleSpec } from "./types.js";

/** Gap between a silence toggle and the puff we send for the learner. */
const PUFF_DELAY_MS = 500;

const BUTTON =
  "min-h-12 rounded-xl px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function ModuleRunner({
  module,
  lesson,
}: {
  module: ModuleSpec;
  lesson: LessonModule;
}) {
  const [phase, setPhase] = useState<LessonPhase>({
    kind: "step",
    index: 0,
    done: false,
  });
  const [puffPending, setPuffPending] = useState(false);
  const puffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const stimulating = useViewerStore((state) => state.stimulating);
  const puffing = Object.values(stimulating).some(Boolean);

  const step = phase.kind === "step" ? lesson.steps[phase.index] : undefined;
  const revealed =
    phase.kind === "step" && phase.done && !puffPending && !puffing;

  const clearPuff = useCallback(() => {
    if (puffTimer.current !== null) clearTimeout(puffTimer.current);
    puffTimer.current = null;
    setPuffPending(false);
  }, []);

  const startOver = useCallback(() => {
    clearPuff();
    useViewerStore.getState().resetControls();
    enqueue({ type: "reset" });
    setPhase({ kind: "step", index: 0, done: false });
  }, [clearPuff]);

  // The circuit is cached across pages, so start from a clean brain.
  useEffect(() => {
    startOver();
    return () => {
      clearPuff();
      useViewerStore.getState().setFocus([]);
    };
  }, [startOver, clearPuff]);

  useEffect(() => {
    useViewerStore.getState().setFocus(focusFor(lesson, phase));
  }, [lesson, phase]);

  // Keep the instructions on screen when the panel has scrolled to a control.
  useEffect(() => {
    bringIntoView(cardRef.current);
  }, [phase.kind, step, revealed]);

  const gate: ControlGate = (kind, colorGroup) =>
    controlState(lesson, phase, kind, colorGroup);

  function onAction(action: ControlAction) {
    if (phase.kind !== "step" || phase.done || !step) return;
    if (!meetsGoal(step.goal, action)) return;
    setPhase({ ...phase, done: true });
    const puff = step.puff;
    if (!puff) return;
    setPuffPending(true);
    puffTimer.current = setTimeout(() => {
      puffTimer.current = null;
      useViewerStore.getState().setStimulating(puff, true);
      enqueue({ type: "stimulate", colorGroup: puff });
      setPuffPending(false);
    }, PUFF_DELAY_MS);
  }

  function next() {
    if (phase.kind !== "step") return;
    const index = phase.index + 1;
    if (index < lesson.steps.length) {
      setPhase({ kind: "step", index, done: false });
    } else {
      setPhase({ kind: "check", picked: null });
    }
  }

  return (
    <Panel module={module} gate={gate} onAction={onAction}>
      <section
        ref={cardRef}
        aria-label={lesson.title}
        className="flex scroll-mt-4 flex-col gap-4 rounded-2xl bg-white/[0.06] p-4"
      >
        <Progress lesson={lesson} phase={phase} />
        {phase.kind === "step" && step ? (
          <>
            <p className="text-lg leading-snug text-zinc-50">{step.text}</p>
            <div aria-live="polite" className="flex flex-col gap-4">
              {revealed ? (
                <>
                  <p className="border-l-4 border-white/40 pl-3 text-base leading-snug text-zinc-200">
                    {step.result}
                  </p>
                  <button
                    type="button"
                    onClick={next}
                    className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
                  >
                    {phase.index + 1 < lesson.steps.length
                      ? "Next"
                      : "One quick question"}
                  </button>
                </>
              ) : phase.done ? (
                <p className="text-sm text-zinc-400">Watch the brain…</p>
              ) : (
                <p className="text-sm text-zinc-400">
                  Tap the glowing button below.
                </p>
              )}
            </div>
          </>
        ) : null}
        {phase.kind === "check" ? (
          <Check
            lesson={lesson}
            picked={phase.picked}
            onPick={(picked) => setPhase({ kind: "check", picked })}
            onDone={() => setPhase({ kind: "free" })}
          />
        ) : null}
        {phase.kind === "free" ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-50">
              {lesson.freePlay.title}
            </h2>
            <p className="text-base leading-snug text-zinc-200">
              {lesson.freePlay.text}
            </p>
          </>
        ) : null}
        {phase.kind === "step" && phase.index === 0 && !phase.done ? null : (
          <button
            type="button"
            onClick={startOver}
            className="self-start text-sm text-zinc-400 underline underline-offset-4 hover:text-zinc-200"
          >
            Start the lesson again
          </button>
        )}
      </section>
    </Panel>
  );
}

function Progress({
  lesson,
  phase,
}: {
  lesson: LessonModule;
  phase: LessonPhase;
}) {
  const total = lesson.steps.length + 1;
  const at =
    phase.kind === "step"
      ? phase.index
      : phase.kind === "check"
        ? lesson.steps.length
        : total;
  const label =
    phase.kind === "step"
      ? `Step ${phase.index + 1} of ${lesson.steps.length}`
      : phase.kind === "check"
        ? "Quick question"
        : "Lesson done";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
        {label}
      </p>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < at ? "bg-zinc-50" : index === at ? "bg-zinc-400" : "bg-white/15"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Check({
  lesson,
  picked,
  onPick,
  onDone,
}: {
  lesson: LessonModule;
  picked: number | null;
  onPick: (index: number) => void;
  onDone: () => void;
}) {
  const choice = picked === null ? undefined : lesson.check.choices[picked];
  const solved = choice?.correct === true;
  const feedbackRef = useRef<HTMLDivElement>(null);

  // On a phone the feedback and the way on sit below the answers.
  useEffect(() => {
    if (picked !== null) bringIntoView(feedbackRef.current);
  }, [picked]);
  return (
    <>
      <p className="text-lg leading-snug text-zinc-50">
        {lesson.check.question}
      </p>
      <div role="group" aria-label="Answers" className="flex flex-col gap-2">
        {lesson.check.choices.map((item, index) => {
          const chosen = picked === index;
          const tone = !chosen
            ? "border-white/15 bg-white/5 text-zinc-100"
            : item.correct
              ? "border-emerald-400 bg-emerald-400/15 text-zinc-50"
              : "border-amber-400 bg-amber-400/10 text-zinc-50";
          return (
            <button
              key={item.text}
              type="button"
              disabled={solved}
              aria-pressed={chosen}
              onClick={() => onPick(index)}
              className={`min-h-12 rounded-xl border px-4 py-3 text-left text-base leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default ${tone}`}
            >
              {item.text}
            </button>
          );
        })}
      </div>
      <div
        ref={feedbackRef}
        aria-live="polite"
        className="flex scroll-mb-4 flex-col gap-4"
      >
        {choice ? (
          <p className="text-base leading-snug text-zinc-200">
            {choice.feedback}
            {solved ? null : " Try another answer."}
          </p>
        ) : null}
        {solved ? (
          <button
            type="button"
            onClick={onDone}
            className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
          >
            Start free play
          </button>
        ) : null}
      </div>
    </>
  );
}

function bringIntoView(element: HTMLElement | null) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element?.scrollIntoView({
    block: "nearest",
    behavior: reduce ? "auto" : "smooth",
  });
}
