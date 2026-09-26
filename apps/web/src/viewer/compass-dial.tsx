"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Wedge } from "./compass.js";
import { useViewerStore } from "./store.js";

const SIZE = 136;
const CENTER = SIZE / 2;
const INNER = 30;
const OUTER = 54;

/**
 * The ellipsoid body ring, flattened. Each wedge sits at the angle its
 * compass neurons occupy in the real brain, seen from behind the fly, and
 * glows with their flashes. The needle points at the bump.
 */
export function CompassDial({ color }: { color: string }) {
  const readout = useViewerStore((state) => state.compass);
  const wedgeRefs = useRef<(SVGPathElement | null)[]>([]);
  const needleRef = useRef<SVGGElement>(null);
  const shapes = useMemo(
    () => (readout ? wedgePaths(readout.wedges) : []),
    [readout],
  );

  useEffect(() => {
    if (!readout) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      readout.levels.forEach((level, index) => {
        const path = wedgeRefs.current[index];
        if (path) {
          path.setAttribute(
            "fill-opacity",
            (0.1 + 0.9 * Math.min(1, level * 1.6)).toFixed(3),
          );
        }
      });
      const heading = readout.heading();
      const needle = needleRef.current;
      if (needle) {
        const degrees = (heading.angle * 180) / Math.PI;
        needle.setAttribute(
          "transform",
          `rotate(${degrees.toFixed(1)} ${CENTER} ${CENTER})`,
        );
        needle.setAttribute(
          "opacity",
          Math.min(1, heading.strength * 1.4).toFixed(3),
        );
      }
    };
    const stop = readout.subscribe(() => {
      if (frame === 0) frame = requestAnimationFrame(draw);
    });
    draw();
    return () => {
      stop();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [readout]);

  if (!readout) return null;
  return (
    <figure className="pointer-events-none flex select-none flex-col items-center gap-1 rounded-2xl bg-zinc-950/75 px-2 pt-2 pb-1.5 backdrop-blur-sm">
      <svg
        role="img"
        aria-label="Compass dial. The glowing wedges and the needle show where the bump sits on the ring."
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-28 md:size-36"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={(INNER + OUTER) / 2}
          fill="none"
          stroke="rgb(255 255 255 / 0.08)"
          strokeWidth={OUTER - INNER + 4}
        />
        {shapes.map((shape, index) => (
          <path
            key={shape.key}
            ref={(element) => {
              wedgeRefs.current[index] = element;
            }}
            d={shape.d}
            fill={color}
            fillOpacity={0.1}
            stroke="#09090b"
            strokeWidth={1.5}
          />
        ))}
        <g ref={needleRef} opacity={0}>
          <line
            x1={CENTER}
            y1={CENTER}
            x2={CENTER}
            y2={CENTER - INNER + 4}
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER - INNER + 4} r={3.5} fill="white" />
        </g>
        <circle cx={CENTER} cy={CENTER} r={3} fill="white" opacity={0.6} />
        <text
          x={8}
          y={CENTER + 4}
          className="fill-zinc-400 text-[11px] font-semibold"
        >
          L
        </text>
        <text
          x={SIZE - 15}
          y={CENTER + 4}
          className="fill-zinc-400 text-[11px] font-semibold"
        >
          R
        </text>
      </svg>
      <figcaption className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
        Compass · from behind
      </figcaption>
    </figure>
  );
}

/** Annular sectors that meet halfway between neighboring wedges. */
function wedgePaths(wedges: readonly Wedge[]): { key: string; d: string }[] {
  const count = wedges.length;
  const order = wedges
    .map((wedge, index) => ({ index, angle: wedge.angle }))
    .sort((a, b) => a.angle - b.angle);
  const bounds = new Map<number, [number, number]>();
  order.forEach((item, at) => {
    const prev = order[(at - 1 + count) % count]!;
    const next = order[(at + 1) % count]!;
    const before = gap(prev.angle, item.angle) / 2;
    const after = gap(item.angle, next.angle) / 2;
    bounds.set(item.index, [item.angle - before, item.angle + after]);
  });
  return wedges.map((wedge, index) => {
    const [from, to] = bounds.get(index) ?? [wedge.angle, wedge.angle];
    return { key: wedge.glomerulus, d: sector(from, to) };
  });
}

function gap(from: number, to: number): number {
  const turn = 2 * Math.PI;
  return (((to - from) % turn) + turn) % turn;
}

function point(angle: number, radius: number): string {
  const x = CENTER + radius * Math.sin(angle);
  const y = CENTER - radius * Math.cos(angle);
  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

function sector(from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  return [
    `M ${point(from, INNER)}`,
    `L ${point(from, OUTER)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(to, OUTER)}`,
    `L ${point(to, INNER)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(from, INNER)}`,
    "Z",
  ].join(" ");
}
