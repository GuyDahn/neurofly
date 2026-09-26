"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CompassDial } from "./compass-dial.js";
import { groupColor } from "./module.js";
import { findLesson, LESSONS, type LessonEntry } from "./modules.js";
import { ModuleRunner } from "./module-runner.js";
import {
  decodeReplay,
  REPLAY_PARAM,
  ReplayError,
  replayProblem,
  type Replay,
} from "./replay.js";
import { ReplayRunner } from "./replay-runner.js";
import { useViewerStore } from "./store.js";

const Scene = dynamic(() => import("./scene.js"), { ssr: false });

type Shared = { entry: LessonEntry; replay: Replay };

export function Viewer({ lessonId }: { lessonId: string }) {
  const home = findLesson(lessonId) ?? LESSONS[0]!;
  const [shared, setShared] = useState<Shared | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A share link names its own lesson, so it wins over the page it opens on.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(REPLAY_PARAM);
    if (raw === null) return;
    try {
      const replay = decodeReplay(raw);
      const entry = findLesson(replay.lessonId);
      if (!entry) {
        throw new ReplayError(
          "This replay is for a lesson this site does not have.",
        );
      }
      const problem = replayProblem(replay, entry.module);
      if (problem) throw new ReplayError(problem);
      if (entry.path !== window.location.pathname) {
        window.history.replaceState(
          null,
          "",
          `${entry.path}${window.location.search}`,
        );
      }
      setShared({ entry, replay });
    } catch (error) {
      // Drop the broken link so a reload or a share does not carry it on.
      const url = new URL(window.location.href);
      url.searchParams.delete(REPLAY_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      setNotice(
        error instanceof ReplayError
          ? `${error.message} Here is the lesson instead.`
          : "That replay link did not work. Here is the lesson instead.",
      );
    }
  }, []);

  function exitReplay() {
    const url = new URL(window.location.href);
    url.searchParams.delete(REPLAY_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setShared(null);
  }

  const entry = shared?.entry ?? home;

  // A share link can open a different lesson than the page it landed on.
  useEffect(() => {
    document.title = `${entry.lesson.title} · Neurofly`;
  }, [entry]);
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100 scheme-dark md:flex-row">
      {shared ? (
        <ReplayRunner
          key={`${shared.entry.id}-replay`}
          entry={shared.entry}
          replay={shared.replay}
          onExit={exitReplay}
        />
      ) : (
        <ModuleRunner key={entry.id} entry={entry} notice={notice} />
      )}
      <Stage entry={entry} />
    </div>
  );
}

function Stage({ entry }: { entry: LessonEntry }) {
  const status = useViewerStore((state) => state.status);
  const error = useViewerStore((state) => state.error);
  const progress = useViewerStore((state) => state.progress);
  const percent = Math.round(progress * 100);
  const { module, lesson } = entry;

  return (
    <div className="relative order-1 min-h-0 flex-1 bg-zinc-950 md:order-2">
      <header className="pointer-events-none absolute top-0 right-0 left-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
          Neurofly · Lesson {entry.number}
        </p>
        <h1 className="max-w-md text-xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
          {lesson.title}
        </h1>
        <p className="mt-1 hidden max-w-sm text-sm leading-snug text-zinc-300 md:block">
          {lesson.summary}
        </p>
      </header>
      <p className="sr-only">
        Three-dimensional view of the neurons. Drag to turn it. Pinch to zoom.
      </p>
      <div className="absolute inset-0 touch-none">
        <Scene module={module} />
      </div>
      {module.compass && status === "ready" ? (
        <div className="absolute right-3 bottom-3 z-10 md:right-4 md:bottom-4">
          <CompassDial color={groupColor(module, module.compass.colorGroup)} />
        </div>
      ) : null}
      {status === "loading" ? (
        <p className="pointer-events-none absolute right-4 bottom-3 left-4 text-center text-sm text-zinc-300">
          Loading the circuit{percent > 0 ? `… ${percent}%` : "…"}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="absolute right-4 bottom-3 left-4 rounded-xl bg-red-950/90 px-3 py-2 text-sm text-red-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
