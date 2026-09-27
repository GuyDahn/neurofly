"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { readCascade, type Cascade } from "./cascade.js";
import { LoopPlayer, type LoopFrame } from "./loop-player.js";
import { fill } from "./text.js";

export type LoopStep = {
  colorGroup: string;
  color: string;
  label: string;
  /** Cell count and first spike, already in the reader's language. */
  detail: string;
};

/** Everything the loop says, already translated on the server. */
export type LoopCopy = {
  label: string;
  /** "{ms} ms of fly time": a plain placeholder, filled on every frame. */
  clock: string;
  waiting: string;
  pause: string;
  play: string;
  loading: string;
  failed: string;
};

type Status = "loading" | "ready" | "failed";

/**
 * The escape lesson's first swatter as an 8-second loop on the landing page.
 * It starts on its own unless the reader prefers reduced motion, pauses
 * off screen, and can always be paused.
 */
export function EscapeLoop({
  src,
  steps,
  copy,
  caption,
  locale,
}: {
  /** Versioned URL of the baked cascade, or null when the build had no data. */
  src: string | null;
  /** The lesson groups in the order the signal reaches them. */
  steps: LoopStep[];
  copy: LoopCopy;
  caption: ReactNode;
  locale: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef<HTMLParagraphElement>(null);
  const rows = useRef<Record<string, HTMLLIElement | null>>({});
  const player = useRef<LoopPlayer | null>(null);
  const [cascade, setCascade] = useState<Cascade | null>(null);
  const [status, setStatus] = useState<Status>(src ? "loading" : "failed");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!src) return;
    let active = true;
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!active) return;
        setCascade(readCascade(value));
      })
      .catch(() => {
        if (active) setStatus("failed");
      });
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    const target = canvas.current;
    const frame = box.current;
    if (!cascade || !target || !frame) return;
    let current: LoopPlayer;
    try {
      const format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      current = new LoopPlayer(target, cascade, (next) =>
        paintLegend(next, cascade, rows.current, clock.current, (ms) =>
          ms === null
            ? copy.waiting
            : fill(copy.clock, { ms: format.format(ms) }),
        ),
      );
    } catch {
      setStatus("failed");
      return;
    }
    player.current = current;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      current.resize(rect.width, rect.height);
    };
    measure();
    const resizes = new ResizeObserver(measure);
    resizes.observe(frame);
    const views = new IntersectionObserver(([entry]) => {
      current.setVisible(entry?.isIntersecting ?? true);
    });
    views.observe(frame);
    setStatus("ready");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.showStill();
      setPlaying(false);
    } else {
      current.play();
      setPlaying(true);
    }
    return () => {
      resizes.disconnect();
      views.disconnect();
      current.dispose();
      player.current = null;
    };
  }, [cascade, copy, locale]);

  function toggle() {
    const current = player.current;
    if (!current) return;
    if (current.isPlaying) current.pause();
    else current.play();
    setPlaying(current.isPlaying);
  }

  return (
    <figure className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
      <div ref={box} className="relative aspect-[16/10] w-full">
        <canvas
          ref={canvas}
          role="img"
          aria-label={copy.label}
          className="absolute inset-0 size-full"
        />
        <p
          ref={clock}
          aria-hidden="true"
          className="pointer-events-none absolute start-4 top-3 text-xs font-semibold tracking-[0.12em] text-zinc-400 uppercase tabular-nums"
        />
        {status === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            {copy.loading}
          </p>
        ) : null}
        {status === "failed" ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-400">
            {copy.failed}
          </p>
        ) : null}
        {status === "ready" ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? copy.pause : copy.play}
            className="absolute end-3 bottom-3 flex size-10 items-center justify-center rounded-full border border-white/15 bg-zinc-950/70 text-zinc-100 backdrop-blur hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {playing ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 fill-current"
              >
                <rect x="3.5" y="3" width="3" height="10" rx="0.8" />
                <rect x="9.5" y="3" width="3" height="10" rx="0.8" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 fill-current"
              >
                <path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
      <figcaption className="flex flex-col gap-4 border-t border-white/10 px-4 py-4 sm:px-5">
        <ol className="grid gap-2 sm:grid-cols-3 sm:gap-3">
          {steps.map((step) => (
            <li
              key={step.colorGroup}
              ref={(node) => {
                rows.current[step.colorGroup] = node;
              }}
              data-fired="false"
              className="group flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-300 data-[fired=true]:bg-white/[0.06]"
            >
              <span
                aria-hidden="true"
                className="mt-1.5 size-2.5 shrink-0 rounded-full opacity-40 transition-opacity duration-300 group-data-[fired=true]:opacity-100"
                style={{
                  backgroundColor: step.color,
                  boxShadow: `0 0 10px ${step.color}`,
                }}
              />
              <span className="flex flex-col">
                <span className="text-sm leading-snug text-zinc-300 transition-colors duration-300 group-data-[fired=true]:text-zinc-50">
                  {step.label}
                </span>
                <span className="min-h-4 text-xs text-zinc-400 tabular-nums">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs leading-relaxed text-zinc-400">{caption}</p>
      </figcaption>
    </figure>
  );
}

/** Writes the clock and the legend straight to the DOM, so frames never re-render React. */
function paintLegend(
  frame: LoopFrame,
  cascade: Cascade,
  rows: Record<string, HTMLLIElement | null>,
  clock: HTMLParagraphElement | null,
  clockText: (flyMs: number | null) => string,
) {
  if (clock) {
    const text = clockText(frame.flyMs);
    if (clock.textContent !== text) clock.textContent = text;
  }
  cascade.groups.forEach((group, index) => {
    const row = rows[group.colorGroup];
    if (!row) return;
    const fired = String(frame.fired[index] === true);
    if (row.dataset.fired !== fired) row.dataset.fired = fired;
  });
}
