"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LESSONS, type LessonEntry } from "./modules.js";
import { FOCUS_RING } from "./panel.js";
import { recording } from "./recorder.js";
import { replayUrl } from "./replay.js";

/** Lesson switcher and Share, at the top of the sheet where a thumb reaches. */
export function Toolbar({ entry }: { entry: LessonEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="lesson-list"
          onClick={() => setOpen((value) => !value)}
          className={`flex min-h-10 items-center gap-2 rounded-full border border-white/15 px-3.5 text-sm font-semibold text-zinc-200 hover:bg-white/5 ${FOCUS_RING}`}
        >
          Lesson {entry.number} of {LESSONS.length}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className={`size-3 fill-none stroke-current transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth="1.8"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
        </button>
        <ShareButton entry={entry} />
      </div>
      {open ? (
        <ol id="lesson-list" className="flex flex-col gap-1.5">
          {LESSONS.map((item) => {
            const current = item.id === entry.id;
            return (
              <li key={item.id}>
                <Link
                  href={item.path}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm ${FOCUS_RING} ${current ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5"}`}
                >
                  <span className="w-5 text-zinc-500 tabular-nums">
                    {item.number}
                  </span>
                  <span className="flex-1">{item.lesson.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

/** Copies a link that replays this run: lesson, seed, and every press with its tick. */
export function ShareButton({ entry }: { entry: LessonEntry }) {
  const [note, setNote] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    field.current?.select();
  }, [manual]);

  async function share() {
    const run = recording(entry.id);
    const url = replayUrl(window.location.origin, entry.path, run);
    if (timer.current !== null) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(url);
      setManual(null);
      setNote(
        run.actions.length > 0
          ? "Link copied. It replays your run."
          : "Link copied. Press a button first to share a run.",
      );
      timer.current = setTimeout(() => setNote(null), 4000);
    } catch {
      setNote("Copy this link:");
      setManual(url);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void share()}
        className={`flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-3.5 text-sm font-semibold text-zinc-100 hover:bg-white/15 ${FOCUS_RING}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 fill-none stroke-current"
          strokeWidth="1.6"
        >
          <path d="M8 10V2.5M5 5.5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" />
        </svg>
        Share
      </button>
      <div
        aria-live="polite"
        className="absolute top-full right-0 z-10 mt-2 flex w-64 flex-col items-end gap-2 text-right text-xs text-zinc-300"
      >
        {note ? (
          <p className="rounded-lg bg-zinc-800 px-2.5 py-1.5 shadow-lg">
            {note}
          </p>
        ) : null}
        {manual ? (
          <input
            ref={field}
            readOnly
            value={manual}
            aria-label="Link to this run"
            onFocus={(event) => event.currentTarget.select()}
            className="w-64 rounded-lg border border-white/15 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
          />
        ) : null}
      </div>
    </div>
  );
}
