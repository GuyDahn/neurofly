"use client";

import type { ReactNode } from "react";
import { enqueue } from "./commands.js";
import { groupColor } from "./module.js";
import { useViewerStore } from "./store.js";
import type {
  ControlAction,
  ControlGate,
  ControlSpec,
  ControlState,
  ModuleSpec,
} from "./types.js";

const openGate: ControlGate = () => "open";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function Panel({
  module,
  gate = openGate,
  onAction,
  children,
}: {
  module: ModuleSpec;
  /** Decides which controls a lesson step allows. Everything is open without one. */
  gate?: ControlGate;
  onAction?: (action: ControlAction) => void;
  /** Rendered above the controls, e.g. the current lesson step. */
  children?: ReactNode;
}) {
  const status = useViewerStore((state) => state.status);
  const stimulating = useViewerStore((state) => state.stimulating);
  const silenced = useViewerStore((state) => state.silenced);
  const activity = useViewerStore((state) => state.activity);
  const focus = useViewerStore((state) => state.focus);
  const setStimulating = useViewerStore((state) => state.setStimulating);
  const setSilenced = useViewerStore((state) => state.setSilenced);
  const resetControls = useViewerStore((state) => state.resetControls);
  const ready = status === "ready";
  const resetState = gate("reset");

  return (
    <aside className="order-2 flex max-h-[52dvh] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-white/10 md:order-1 md:max-h-none md:w-96 md:border-r md:border-t-0">
      <div className="flex flex-col gap-6 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
        <Section title="Stimulate">
          {module.stimuli.map((control) => (
            <StimulateButton
              key={control.colorGroup}
              control={control}
              color={groupColor(module, control.colorGroup)}
              pressed={stimulating[control.colorGroup] === true}
              state={gate("stimulate", control.colorGroup)}
              disabled={!ready}
              onPress={() => {
                setStimulating(control.colorGroup, true);
                enqueue({ type: "stimulate", colorGroup: control.colorGroup });
                onAction?.({
                  type: "stimulate",
                  colorGroup: control.colorGroup,
                });
              }}
            />
          ))}
        </Section>
        <Section title="Silence">
          {module.silence.map((control) => {
            const on = silenced[control.colorGroup] === true;
            return (
              <SilenceButton
                key={control.colorGroup}
                control={control}
                color={groupColor(module, control.colorGroup)}
                pressed={on}
                state={gate("silence", control.colorGroup)}
                disabled={!ready}
                onPress={() => {
                  const next = !on;
                  setSilenced(control.colorGroup, next);
                  enqueue({
                    type: "silence",
                    colorGroup: control.colorGroup,
                    on: next,
                  });
                  onAction?.({
                    type: "silence",
                    colorGroup: control.colorGroup,
                    on: next,
                  });
                }}
              />
            );
          })}
        </Section>
        <Section title="Activity">
          <ul className="flex flex-col gap-3">
            {module.groups.map((group) => {
              const level = activity[group.colorGroup] ?? 0;
              const percent = Math.round(level * 100);
              const dim = focus.length > 0 && !focus.includes(group.colorGroup);
              return (
                <li
                  key={group.colorGroup}
                  className={`flex flex-col gap-1.5 transition-opacity ${dim ? "opacity-40" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-zinc-200">{group.label}</span>
                    <span className="w-10 text-right text-zinc-400 tabular-nums">
                      {percent}%
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${group.label} activity`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-2.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-150 ease-out ${level > 0 ? "min-w-1" : ""}`}
                      style={{
                        width: `${level * 100}%`,
                        backgroundColor: group.color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
        {resetState === "locked" ? null : (
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              resetControls();
              enqueue({ type: "reset" });
              onAction?.({ type: "reset" });
            }}
            className={`min-h-12 rounded-xl border border-white/20 text-base font-semibold text-zinc-100 transition-colors hover:bg-white/5 disabled:opacity-40 ${FOCUS_RING}`}
          >
            Reset
          </button>
        )}
        <p className="text-xs leading-relaxed text-zinc-500">
          Drag to turn the brain. Pinch to zoom.
        </p>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A control the current step does not allow: one short row, clearly off. */
function LockedButton({ color, name }: { color: string; name: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-white/15 px-4 py-2 text-left text-sm text-zinc-500"
    >
      <span
        className="inline-block size-2.5 shrink-0 rounded-full opacity-50"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1">{name}</span>
      <span className="text-xs tracking-[0.14em] uppercase">Locked</span>
    </button>
  );
}

// An outline, not a ring, so it survives the inline box-shadow a silenced
// button already draws.
function cueClass(state: ControlState): string {
  return state === "cue"
    ? "outline-4 outline-offset-4 outline-white/80 motion-safe:animate-pulse"
    : "";
}

function StimulateButton({
  control,
  color,
  pressed,
  state,
  disabled,
  onPress,
}: {
  control: ControlSpec;
  color: string;
  pressed: boolean;
  state: ControlState;
  disabled: boolean;
  onPress: () => void;
}) {
  if (state === "locked") {
    return <LockedButton color={color} name={`Stimulate ${control.name}`} />;
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      data-cue={state === "cue" ? "" : undefined}
      onClick={onPress}
      className={`flex min-h-[4.75rem] w-full touch-manipulation flex-col items-start gap-1 rounded-2xl px-4 py-3.5 text-left text-zinc-950 transition-transform active:scale-[0.99] disabled:opacity-40 ${FOCUS_RING} ${pressed ? "ring-2 ring-white" : ""} ${cueClass(state)}`}
      style={{ backgroundColor: color }}
    >
      <span className="text-xs font-semibold tracking-[0.14em] uppercase">
        Stimulate
      </span>
      <span className="text-lg leading-tight font-semibold">
        {control.name}
      </span>
      <span className="text-sm leading-snug">{control.label}</span>
    </button>
  );
}

function SilenceButton({
  control,
  color,
  pressed,
  state,
  disabled,
  onPress,
}: {
  control: ControlSpec;
  color: string;
  pressed: boolean;
  state: ControlState;
  disabled: boolean;
  onPress: () => void;
}) {
  if (state === "locked") {
    return (
      <LockedButton
        color={color}
        name={`${pressed ? "Silenced" : "Silence"}: ${control.name}`}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      data-cue={state === "cue" ? "" : undefined}
      onClick={onPress}
      className={`flex min-h-16 w-full touch-manipulation flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left disabled:opacity-40 ${FOCUS_RING} ${cueClass(state)}`}
      style={pressed ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
    >
      <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {pressed ? "Silenced" : "Silence"}
      </span>
      <span className="text-base leading-tight font-semibold text-zinc-100">
        {control.name}
      </span>
      <span className="text-sm leading-snug text-zinc-300">
        {control.label}
      </span>
    </button>
  );
}
