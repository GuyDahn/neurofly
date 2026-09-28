"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { enqueue } from "./commands.js";
import { useCircuitCopy } from "./copy.js";
import { groupColor } from "./module.js";
import { useViewerStore } from "./store.js";
import type {
  ControlAction,
  ControlGate,
  ControlState,
  ModuleSpec,
} from "./types.js";

const openGate: ControlGate = () => "open";

export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Sends a control to the brain. The list and the lesson's action bar both press through here. */
export function press(
  action: ControlAction,
  onAction?: (action: ControlAction) => void,
) {
  const store = useViewerStore.getState();
  if (action.type === "stimulate") {
    store.setStimulating(action.colorGroup, true);
    enqueue(action);
  } else if (action.type === "silence") {
    store.setSilenced(action.colorGroup, action.on);
    enqueue(action);
  } else {
    store.resetControls();
    enqueue({ type: "reset" });
  }
  onAction?.(action);
}

export function Controls({
  module,
  gate = openGate,
  onAction,
  readOnly = false,
}: {
  module: ModuleSpec;
  /** Decides which controls a lesson step allows. Everything is open without one. */
  gate?: ControlGate;
  onAction?: (action: ControlAction) => void;
  /** Shows state without taking presses, e.g. while a replay plays. */
  readOnly?: boolean;
}) {
  const status = useViewerStore((state) => state.status);
  const stimulating = useViewerStore((state) => state.stimulating);
  const silenced = useViewerStore((state) => state.silenced);
  const disabled = status !== "ready" || readOnly;
  const resetState = gate("reset");
  const t = useTranslations("viewer.controls");
  const circuit = useCircuitCopy(module);

  return (
    <>
      <Section title={t("stimulate")}>
        {module.stimuli.map((control) => (
          <StimulateButton
            key={control.colorGroup}
            name={circuit.name(control.colorGroup)}
            label={circuit.stimulate(control.colorGroup)}
            color={groupColor(module, control.colorGroup)}
            pressed={stimulating[control.colorGroup] === true}
            state={readOnly ? "open" : gate("stimulate", control.colorGroup)}
            disabled={disabled}
            onPress={() =>
              press(
                { type: "stimulate", colorGroup: control.colorGroup },
                onAction,
              )
            }
          />
        ))}
      </Section>
      {module.silence.length > 0 ? (
        <Section title={t("silence")}>
          {module.silence.map((control) => {
            const on = silenced[control.colorGroup] === true;
            return (
              <SilenceButton
                key={control.colorGroup}
                name={circuit.name(control.colorGroup)}
                label={circuit.silence(control.colorGroup)}
                color={groupColor(module, control.colorGroup)}
                pressed={on}
                state={readOnly ? "open" : gate("silence", control.colorGroup)}
                disabled={disabled}
                onPress={() =>
                  press(
                    {
                      type: "silence",
                      colorGroup: control.colorGroup,
                      on: !on,
                    },
                    onAction,
                  )
                }
              />
            );
          })}
        </Section>
      ) : null}
      <Activity module={module} />
      {resetState === "locked" || readOnly ? null : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => press({ type: "reset" }, onAction)}
          className={`min-h-12 rounded-xl border border-border-strong text-base font-semibold text-fg-muted transition-colors hover:bg-overlay disabled:opacity-40 ${FOCUS_RING}`}
        >
          {t("reset")}
        </button>
      )}
      <p className="text-xs leading-relaxed text-fg-subtle">{t("dragHint")}</p>
    </>
  );
}

function Activity({ module }: { module: ModuleSpec }) {
  const activity = useViewerStore((state) => state.activity);
  const focus = useViewerStore((state) => state.focus);
  const t = useTranslations("viewer.controls");
  const format = useFormatter();
  const circuit = useCircuitCopy(module);
  return (
    <Section title={t("activity")}>
      <ul className="flex flex-col gap-3">
        {module.groups.map((group) => {
          const level = activity[group.colorGroup] ?? 0;
          const percent = Math.round(level * 100);
          const name = circuit.name(group.colorGroup);
          const dim = focus.length > 0 && !focus.includes(group.colorGroup);
          return (
            <li
              key={group.colorGroup}
              className={`flex flex-col gap-1.5 transition-opacity ${dim ? "opacity-40" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-fg-muted">{name}</span>
                <span className="w-12 shrink-0 text-end text-fg-subtle tabular-nums">
                  {format.number(percent / 100, { style: "percent" })}
                </span>
              </div>
              <div
                role="meter"
                aria-label={t("activityLabel", { group: name })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2.5 overflow-hidden rounded-full bg-overlay-strong"
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
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * A control the current step does not allow: one short row, clearly off.
 * Tapping it says why instead of doing nothing.
 */
function LockedButton({ color, name }: { color: string; name: string }) {
  const [told, setTold] = useState(false);
  const t = useTranslations("viewer.controls");
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-disabled="true"
        onClick={() => setTold(true)}
        className={`flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2 text-start text-sm text-fg-subtle ${FOCUS_RING}`}
      >
        <span
          className="inline-block size-2.5 shrink-0 rounded-full opacity-50"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1">{name}</span>
        <LockIcon />
        <span className="text-xs tracking-[0.14em] uppercase">
          {t("locked")}
        </span>
      </button>
      {told ? (
        <p role="status" className="px-1 text-xs text-fg-subtle">
          {t("lockedHint")}
        </p>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 fill-none stroke-current"
      strokeWidth="1.6"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

// An outline, not a ring, so it survives the inline box-shadow a silenced
// button already draws. Only the outline pulses, so the label keeps its
// contrast the whole time.
function cueClass(state: ControlState): string {
  return state === "cue"
    ? "outline-4 outline-offset-4 outline-ring/80 motion-safe:animate-cue"
    : "";
}

function StimulateButton({
  name,
  label,
  color,
  pressed,
  state,
  disabled,
  onPress,
}: {
  name: string;
  label: string;
  color: string;
  pressed: boolean;
  state: ControlState;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("viewer.controls");
  if (state === "locked") {
    return <LockedButton color={color} name={t("stimulateNamed", { name })} />;
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      data-cue={state === "cue" ? "" : undefined}
      onClick={onPress}
      className={`flex min-h-[4.75rem] w-full touch-manipulation flex-col items-start gap-1 rounded-2xl px-4 py-3.5 text-start text-zinc-950 transition-transform active:scale-[0.99] disabled:opacity-40 ${FOCUS_RING} ${pressed ? "ring-2 ring-white" : ""} ${cueClass(state)}`}
      style={{ backgroundColor: color }}
    >
      <span className="text-xs font-semibold tracking-[0.14em] uppercase">
        {t("stimulate")}
      </span>
      <span className="text-lg leading-tight font-semibold">{name}</span>
      <span className="text-sm leading-snug">{label}</span>
    </button>
  );
}

function SilenceButton({
  name,
  label,
  color,
  pressed,
  state,
  disabled,
  onPress,
}: {
  name: string;
  label: string;
  color: string;
  pressed: boolean;
  state: ControlState;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTranslations("viewer.controls");
  if (state === "locked") {
    if (pressed) {
      // Already silenced, and this step doesn't let it be switched back on
      // from here: show that state plainly, rather than the same "Locked"
      // badge used for a control the step hasn't reached yet.
      return (
        <div
          className="flex min-h-16 w-full flex-col items-start gap-1 rounded-2xl border border-border bg-overlay px-4 py-3 text-start"
          style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
        >
          <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {t("silencedLocked")}
          </span>
          <span className="text-base leading-tight font-semibold text-fg">
            {name}
          </span>
        </div>
      );
    }
    return <LockedButton color={color} name={t("silenceNamed", { name })} />;
  }
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      data-cue={state === "cue" ? "" : undefined}
      onClick={onPress}
      className={`flex min-h-16 w-full touch-manipulation flex-col items-start gap-1 rounded-2xl border border-border bg-overlay px-4 py-3 text-start disabled:opacity-40 ${FOCUS_RING} ${cueClass(state)}`}
      style={pressed ? { boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
    >
      <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {pressed ? t("silenced") : t("silence")}
      </span>
      <span className="text-base leading-tight font-semibold text-fg">
        {name}
      </span>
      <span className="text-sm leading-snug text-fg-muted">{label}</span>
    </button>
  );
}
