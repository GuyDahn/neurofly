"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { enqueue } from "./commands.js";
import { Glossed } from "./glossed.js";
import {
  controlState,
  focusFor,
  meetsGoal,
  type LessonGoal,
  type LessonModule,
  type LessonPhase,
} from "./lesson.js";
import { LESSONS, type LessonEntry } from "./modules.js";
import { groupColor } from "./module.js";
import { Controls, FOCUS_RING, press } from "./panel.js";
import { Sheet, type SheetState } from "./sheet.js";
import { useViewerStore } from "./store.js";
import { Toolbar } from "./toolbar.js";
import type { ControlAction, ControlGate, ModuleSpec } from "./types.js";

/** Gap between a silence toggle and the puff we send for the learner. */
const PUFF_DELAY_MS = 500;

const BUTTON = `min-h-12 w-full rounded-xl px-4 text-base font-semibold transition-colors ${FOCUS_RING}`;

export function ModuleRunner({
  entry,
  notice,
  credit,
}: {
  entry: LessonEntry;
  /** A message to show above the lesson, e.g. why a replay link failed. */
  notice?: string | null;
  /** Site credit at the very end of the panel. */
  credit?: ReactNode;
}) {
  const { module, lesson } = entry;
  const [phase, setPhase] = useState<LessonPhase>({
    kind: "step",
    index: 0,
    done: false,
  });
  const [puffPending, setPuffPending] = useState(false);
  const [sheet, setSheet] = useState<SheetState>("peek");
  const puffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stimulating = useViewerStore((state) => state.stimulating);
  const live = useViewerStore((state) => state.circuit === module.id);
  const puffing = Object.values(stimulating).some(Boolean);

  const step = phase.kind === "step" ? lesson.steps[phase.index] : undefined;
  const revealed =
    phase.kind === "step" && phase.done && !puffPending && !puffing;
  const watching = phase.kind === "step" && phase.done && !revealed;

  const clearPuff = useCallback(() => {
    if (puffTimer.current !== null) clearTimeout(puffTimer.current);
    puffTimer.current = null;
    setPuffPending(false);
  }, []);

  const startOver = useCallback(() => {
    clearPuff();
    useViewerStore.getState().resetControls();
    enqueue({ type: "reset", seed: module.seed });
    setPhase({ kind: "step", index: 0, done: false });
    setSheet("peek");
  }, [clearPuff, module.seed]);

  // The circuit is cached across pages, so start from a clean brain once
  // this lesson's own circuit is running.
  useEffect(() => {
    if (live) startOver();
  }, [live, startOver]);

  useEffect(
    () => () => {
      clearPuff();
      useViewerStore.getState().setFocus([]);
    },
    [clearPuff],
  );

  useEffect(() => {
    useViewerStore.getState().setFocus(focusFor(lesson, phase));
  }, [lesson, phase]);

  // On a phone the sheet gets out of the way while the brain is busy, and
  // comes back with the answer. Desktop ignores it.
  useEffect(() => {
    if (watching) setSheet("min");
  }, [watching]);
  useEffect(() => {
    if (revealed) setSheet("peek");
  }, [revealed]);
  useEffect(() => {
    if (phase.kind === "check") setSheet("full");
    if (phase.kind === "free") setSheet("peek");
  }, [phase.kind]);

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

  const solved =
    phase.kind === "check" &&
    phase.picked !== null &&
    lesson.check.choices[phase.picked]?.correct === true;

  return (
    <Sheet
      state={sheet}
      onState={setSheet}
      label={lesson.title}
      moment={`${phase.kind}-${phase.kind === "step" ? phase.index : ""}-${revealed}`}
      footer={
        <Footer
          entry={entry}
          phase={phase}
          goal={phase.kind === "step" && step && !phase.done ? step.goal : null}
          puffPending={puffPending}
          watching={watching}
          revealed={revealed}
          solved={solved}
          onAction={onAction}
          onNext={next}
          onFree={() => setPhase({ kind: "free" })}
        />
      }
    >
      <Toolbar entry={entry} />
      {notice ? (
        <p
          role="status"
          className="rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
        >
          {notice}
        </p>
      ) : null}
      <section
        aria-label={lesson.title}
        className="flex flex-col gap-4 rounded-2xl bg-white/[0.06] p-4"
      >
        <Progress lesson={lesson} phase={phase} />
        {phase.kind === "step" && step ? (
          <>
            <p className="text-lg leading-snug text-zinc-50">
              <Glossed text={step.text} jargon={lesson.jargon} />
            </p>
            <div aria-live="polite" className="flex flex-col gap-4">
              {revealed ? (
                <p className="border-l-4 border-white/40 pl-3 text-base leading-snug text-zinc-200">
                  <Glossed text={step.result} jargon={lesson.jargon} />
                </p>
              ) : phase.done ? (
                <p className="text-sm text-zinc-400">Watch the brain…</p>
              ) : (
                <p className="text-sm text-zinc-400">
                  Tap the glowing button at the bottom.
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
          />
        ) : null}
        {phase.kind === "free" ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-50">
              {lesson.freePlay.title}
            </h2>
            <p className="text-base leading-snug text-zinc-200">
              <Glossed text={lesson.freePlay.text} jargon={lesson.jargon} />
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
      <Controls module={module} gate={gate} onAction={onAction} />
      <PanelCredit>{credit}</PanelCredit>
    </Sheet>
  );
}

/** The site credit line, below everything a lesson needs. */
export function PanelCredit({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-t border-white/10 pt-4 text-xs text-zinc-500">
      {children}
    </div>
  );
}

/** The one thing to do next, pinned where a thumb rests. */
function Footer({
  entry,
  phase,
  goal,
  puffPending,
  watching,
  revealed,
  solved,
  onAction,
  onNext,
  onFree,
}: {
  entry: LessonEntry;
  phase: LessonPhase;
  goal: LessonGoal | null;
  puffPending: boolean;
  watching: boolean;
  revealed: boolean;
  solved: boolean;
  onAction: (action: ControlAction) => void;
  onNext: () => void;
  onFree: () => void;
}) {
  const { module, lesson } = entry;
  if (goal)
    return <CueButton module={module} goal={goal} onAction={onAction} />;
  if (watching) return <Watching module={module} pending={puffPending} />;
  if (revealed && phase.kind === "step") {
    return (
      <button
        type="button"
        onClick={onNext}
        className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
      >
        {phase.index + 1 < lesson.steps.length ? "Next" : "One quick question"}
      </button>
    );
  }
  if (phase.kind === "check") {
    return solved ? (
      <button
        type="button"
        onClick={onFree}
        className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
      >
        Start free play
      </button>
    ) : (
      <p className="py-3 text-center text-sm text-zinc-400">
        Pick the answer you think is right.
      </p>
    );
  }
  const after = LESSONS.find((item) => item.number === entry.number + 1);
  return after ? (
    <Link
      href={after.path}
      className={`${BUTTON} flex items-center justify-center gap-2 bg-zinc-50 text-zinc-950 hover:bg-white`}
    >
      Next lesson: {after.lesson.title}
    </Link>
  ) : (
    <p className="py-3 text-center text-sm text-zinc-400">
      You finished every lesson. Keep exploring.
    </p>
  );
}

/** The step's goal control, repeated at the bottom so it is always in reach. */
function CueButton({
  module,
  goal,
  onAction,
}: {
  module: ModuleSpec;
  goal: LessonGoal;
  onAction: (action: ControlAction) => void;
}) {
  const status = useViewerStore((state) => state.status);
  const ready = status === "ready";
  const color = groupColor(module, goal.colorGroup);
  const list = goal.type === "stimulate" ? module.stimuli : module.silence;
  const name =
    list.find((item) => item.colorGroup === goal.colorGroup)?.name ??
    goal.colorGroup;
  const action: ControlAction =
    goal.type === "stimulate"
      ? { type: "stimulate", colorGroup: goal.colorGroup }
      : { type: "silence", colorGroup: goal.colorGroup, on: goal.on };
  const verb =
    goal.type === "stimulate" ? "Stimulate" : goal.on ? "Silence" : "Switch on";
  const filled = goal.type === "stimulate";
  return (
    <button
      type="button"
      disabled={!ready}
      data-cue=""
      onClick={() => press(action, onAction)}
      className={`flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-transform active:scale-[0.99] disabled:opacity-50 ${FOCUS_RING} ${filled ? "text-zinc-950" : "border-2 bg-white/5 text-zinc-50"}`}
      style={filled ? { backgroundColor: color } : { borderColor: color }}
    >
      <span className="flex flex-1 flex-col">
        <span className="text-xs font-semibold tracking-[0.14em] uppercase opacity-80">
          {ready ? verb : "Loading the brain…"}
        </span>
        <span className="text-lg leading-tight font-semibold">{name}</span>
      </span>
      <span
        aria-hidden="true"
        className="size-3 shrink-0 rounded-full motion-safe:animate-ping"
        style={{ backgroundColor: filled ? "#09090b" : color }}
      />
    </button>
  );
}

/** While the puff runs: where to look, and how far through it the fly is. */
function Watching({
  module,
  pending,
}: {
  module: ModuleSpec;
  pending: boolean;
}) {
  const puff = useViewerStore((state) => state.puff);
  const fraction = puff ? Math.min(1, puff.elapsedMs / puff.totalMs) : 0;
  const name = puff
    ? (module.stimuli.find((item) => item.colorGroup === puff.colorGroup)
        ?.name ?? puff.colorGroup)
    : null;
  return (
    <div className="flex flex-col gap-2 py-1" aria-live="polite">
      <p className="flex items-center gap-2 text-base font-semibold text-zinc-50">
        <span aria-hidden="true" className="md:hidden">
          ↑
        </span>
        <span aria-hidden="true" className="hidden md:inline">
          →
        </span>
        {pending ? "Getting ready… watch the brain" : "Watch the brain"}
      </p>
      <div
        role="progressbar"
        aria-label="Puff progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-zinc-50 transition-[width] duration-100 ease-linear"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <p className="text-xs text-zinc-400 tabular-nums">
        {name && puff
          ? `${name}: ${Math.round(puff.elapsedMs)} of ${puff.totalMs} ms, in slow motion`
          : "In slow motion, so you can follow it"}
      </p>
    </div>
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
}: {
  lesson: LessonModule;
  picked: number | null;
  onPick: (index: number) => void;
}) {
  const choice = picked === null ? undefined : lesson.check.choices[picked];
  const solved = choice?.correct === true;
  const feedbackRef = useRef<HTMLDivElement>(null);

  // On a phone the feedback sits below the answers.
  useEffect(() => {
    if (picked === null) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    feedbackRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [picked]);
  return (
    <>
      <p className="text-lg leading-snug text-zinc-50">
        <Glossed text={lesson.check.question} jargon={lesson.jargon} />
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
              className={`min-h-12 rounded-xl border px-4 py-3 text-left text-base leading-snug disabled:cursor-default ${FOCUS_RING} ${tone}`}
            >
              {item.text}
            </button>
          );
        })}
      </div>
      <div ref={feedbackRef} aria-live="polite" className="scroll-mb-4">
        {choice ? (
          <p className="text-base leading-snug text-zinc-200">
            <Glossed text={choice.feedback} jargon={lesson.jargon} />
            {solved ? null : " Try another answer."}
          </p>
        ) : null}
      </div>
    </>
  );
}
