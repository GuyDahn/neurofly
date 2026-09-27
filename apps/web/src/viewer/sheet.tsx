"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

/**
 * min: only the action bar, so the brain gets the screen.
 * peek: the lesson card and the action bar.
 * full: every control.
 */
export type SheetState = "min" | "peek" | "full";

const ORDER: SheetState[] = ["min", "peek", "full"];
/** Share of the viewport the scrolling body may take on a phone. */
const BODY_SHARE: Record<SheetState, number> = {
  min: 0,
  peek: 0.4,
  full: 0.72,
};
/** Pixels of drag that count as a swipe rather than a tap. */
const SWIPE_PX = 28;

/**
 * Lesson controls. On a phone this is a bottom sheet under the brain: the
 * canvas and the sheet never overlap, so a swipe on the sheet always scrolls
 * the sheet. The action bar stays at the bottom, in reach of a thumb. From
 * the md breakpoint up it is the side panel and ignores `state`.
 */
export function Sheet({
  state,
  onState,
  label,
  moment,
  children,
  footer,
}: {
  state: SheetState;
  onState: (state: SheetState) => void;
  label: string;
  /** Changes when the lesson moves on, which scrolls the card back into view. */
  moment?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const t = useTranslations("viewer.sheet");
  const [viewport, setViewport] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; id: number } | null>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => setViewport(window.innerHeight);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  // A new sheet state or lesson moment: show the card at the top.
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [state, moment]);

  // At rest the body is sized in viewport units, so the server renders the
  // sheet at its real height: the lesson text paints at once and nothing
  // jumps when the page hydrates. A drag works in pixels of the window.
  const base = BODY_SHARE[state] * viewport;
  const height =
    drag === null
      ? `${BODY_SHARE[state] * 100}dvh`
      : `${Math.round(Math.min(Math.max(base - drag, 0), BODY_SHARE.full * viewport))}px`;

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    start.current = { y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(0);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (start.current?.id !== event.pointerId) return;
    setDrag(event.clientY - start.current.y);
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (start.current?.id !== event.pointerId) return;
    const moved = event.clientY - start.current.y;
    start.current = null;
    setDrag(null);
    onState(settle(state, moved, base - moved, viewport));
  }

  function onPointerCancel() {
    start.current = null;
    setDrag(null);
  }

  return (
    <section
      aria-label={label}
      className="relative z-10 order-2 flex w-full shrink-0 flex-col rounded-t-3xl border-t border-white/10 bg-zinc-900 shadow-[0_-12px_32px_rgb(0_0_0/0.45)] md:order-1 md:h-full md:w-96 md:rounded-none md:border-t-0 md:border-e md:bg-zinc-950 md:shadow-none"
    >
      <button
        type="button"
        aria-expanded={state !== "min"}
        aria-label={state === "full" ? t("less") : t("more")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onState(settle(state, 0, base, viewport));
        }}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white md:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-white/30" />
      </button>
      <div
        ref={body}
        style={{ ["--sheet-body" as string]: height }}
        className={`max-h-(--sheet-body) min-h-0 overflow-y-auto overscroll-contain md:max-h-none md:flex-1 ${drag === null ? "transition-[max-height] duration-300 ease-out motion-reduce:transition-none" : ""}`}
      >
        <div className="flex flex-col gap-6 px-4 pt-1 pb-6 md:pt-4">
          {children}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/10 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {footer}
      </div>
    </section>
  );
}

/**
 * Where the sheet goes when a drag lets go. A tap steps it open (or back to
 * peek from full). A swipe lands on the nearest height, and always at least
 * one step in the direction of the swipe.
 */
function settle(
  state: SheetState,
  moved: number,
  height: number,
  viewport: number,
): SheetState {
  const at = ORDER.indexOf(state);
  if (Math.abs(moved) <= SWIPE_PX) {
    return state === "full" ? "peek" : (ORDER[at + 1] ?? state);
  }
  let nearest = state;
  let gap = Infinity;
  for (const option of ORDER) {
    const distance = Math.abs(BODY_SHARE[option] * viewport - height);
    if (distance < gap) {
      gap = distance;
      nearest = option;
    }
  }
  if (nearest !== state) return nearest;
  const next = at + (moved < 0 ? 1 : -1);
  return ORDER[Math.min(Math.max(next, 0), ORDER.length - 1)] ?? state;
}
