"use client";

import type { ReactNode } from "react";
import { enqueue } from "./commands.js";
import { groupColor } from "./module.js";
import { useViewerStore } from "./store.js";
import type { ControlSpec, ModuleSpec } from "./types.js";

export function Panel({ module }: { module: ModuleSpec }) {
  const status = useViewerStore((state) => state.status);
  const stimulating = useViewerStore((state) => state.stimulating);
  const silenced = useViewerStore((state) => state.silenced);
  const activity = useViewerStore((state) => state.activity);
  const setStimulating = useViewerStore((state) => state.setStimulating);
  const setSilenced = useViewerStore((state) => state.setSilenced);
  const resetControls = useViewerStore((state) => state.resetControls);
  const ready = status === "ready";

  return (
    <aside className="order-2 flex max-h-[52dvh] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-white/10 md:order-1 md:max-h-none md:w-96 md:border-r md:border-t-0">
      <div className="flex flex-col gap-6 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Section title="Stimulate">
          {module.stimuli.map((control) => (
            <StimulateButton
              key={control.colorGroup}
              control={control}
              color={groupColor(module, control.colorGroup)}
              pressed={stimulating[control.colorGroup] === true}
              disabled={!ready}
              onPress={() => {
                setStimulating(control.colorGroup, true);
                enqueue({ type: "stimulate", colorGroup: control.colorGroup });
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
                disabled={!ready}
                onPress={() => {
                  const next = !on;
                  setSilenced(control.colorGroup, next);
                  enqueue({
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
              return (
                <li key={group.colorGroup} className="flex flex-col gap-1.5">
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
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            resetControls();
            enqueue({ type: "reset" });
          }}
          className="min-h-12 rounded-xl border border-white/20 text-base font-semibold text-zinc-100 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
        >
          Reset
        </button>
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

function StimulateButton({
  control,
  color,
  pressed,
  disabled,
  onPress,
}: {
  control: ControlSpec;
  color: string;
  pressed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onPress}
      className={`flex min-h-[4.75rem] w-full touch-manipulation flex-col items-start gap-1 rounded-2xl px-4 py-3.5 text-left text-zinc-950 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.99] disabled:opacity-40 ${pressed ? "ring-2 ring-white" : ""}`}
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
  disabled,
  onPress,
}: {
  control: ControlSpec;
  color: string;
  pressed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onPress}
      className="flex min-h-16 w-full touch-manipulation flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
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
