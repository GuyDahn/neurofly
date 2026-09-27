"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { ENDONYMS, localePath } from "../i18n/locales.js";
import { LanguageMenu } from "../site/language-menu.js";
import { SITE_NAME } from "../site/site.js";
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
  type ReplayErrorCode,
} from "./replay.js";
import { ReplayRunner } from "./replay-runner.js";
import { useViewerStore } from "./store.js";

const Scene = dynamic(() => import("./scene.js"), { ssr: false });

type Shared = { entry: LessonEntry; replay: Replay };

export function Viewer({
  lessonId,
  credit,
}: {
  lessonId: string;
  /** Who made the site, shown at the end of the lesson panel. */
  credit?: ReactNode;
}) {
  const entry = findLesson(lessonId) ?? LESSONS[0]!;
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("viewer.replay");
  const [shared, setShared] = useState<Shared | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A share link names its own lesson. If that is not this page's lesson,
  // go to its page, which carries that lesson's words.
  useEffect(() => {
    const search = window.location.search;
    const raw = new URLSearchParams(search).get(REPLAY_PARAM);
    if (raw === null) return;
    let code: ReplayErrorCode | "generic";
    try {
      const replay = decodeReplay(raw);
      const target = findLesson(replay.lessonId);
      if (!target) throw new ReplayError("unknownLesson");
      const problem = replayProblem(replay, target.module);
      if (problem) throw new ReplayError(problem);
      if (target.id !== entry.id) {
        router.replace(`${localePath(locale, target.path)}${search}`);
        return;
      }
      setShared({ entry: target, replay });
      return;
    } catch (error) {
      code = error instanceof ReplayError ? error.code : "generic";
    }
    // Drop the broken link so a reload or a share does not carry it on.
    const url = new URL(window.location.href);
    url.searchParams.delete(REPLAY_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setNotice(t("notice", { problem: t(`errors.${code}`) }));
  }, [entry.id, locale, router, t]);

  function exitReplay() {
    const url = new URL(window.location.href);
    url.searchParams.delete(REPLAY_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setShared(null);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas text-fg md:flex-row">
      {shared ? (
        <ReplayRunner
          key={`${shared.entry.id}-replay`}
          entry={shared.entry}
          replay={shared.replay}
          onExit={exitReplay}
          credit={credit}
        />
      ) : (
        <ModuleRunner
          key={entry.id}
          entry={entry}
          notice={notice}
          credit={credit}
        />
      )}
      <Stage entry={entry} />
    </div>
  );
}

function Stage({ entry }: { entry: LessonEntry }) {
  const status = useViewerStore((state) => state.status);
  const error = useViewerStore((state) => state.error);
  const progress = useViewerStore((state) => state.progress);
  const locale = useLocale();
  const t = useTranslations("viewer");
  const lessonCopy = useTranslations(`lessons.${entry.id}`);
  const percent = Math.round(progress * 100);
  const { module } = entry;

  return (
    <div className="relative order-1 min-h-0 flex-1 bg-zinc-950 md:order-2">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-400 uppercase">
            <Link
              href={localePath(locale, "/")}
              lang="en"
              translate="no"
              className="pointer-events-auto rounded-sm hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {SITE_NAME}
            </Link>{" "}
            · {t("stage.lesson", { number: entry.number })}
          </p>
          <h1 className="max-w-md text-xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
            {lessonCopy("title")}
          </h1>
          <p className="mt-1 hidden max-w-sm text-sm leading-snug text-zinc-300 md:block">
            {lessonCopy("summary")}
          </p>
        </div>
        <StageLanguageMenu path={entry.path} />
      </header>
      <p className="sr-only">{t("stage.canvasHelp")}</p>
      {/* The brain is a real fly's, so it never mirrors for right-to-left languages. */}
      <div className="absolute inset-0 touch-none" dir="ltr">
        <Scene module={module} />
      </div>
      {module.compass && status === "ready" ? (
        <div className="absolute end-3 bottom-3 z-10 md:end-4 md:bottom-4">
          <CompassDial color={groupColor(module, module.compass.colorGroup)} />
        </div>
      ) : null}
      {status === "loading" ? (
        <p className="pointer-events-none absolute inset-x-4 bottom-3 text-center text-sm text-zinc-300">
          {percent > 0
            ? t("stage.loadingPercent", { percent })
            : t("stage.loading")}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="absolute inset-x-4 bottom-3 rounded-xl bg-red-950/90 px-3 py-2 text-sm text-red-100"
        >
          {t(`load.${error}`)}
        </p>
      ) : null}
    </div>
  );
}

function StageLanguageMenu({ path }: { path: string }) {
  const locale = useLocale();
  const t = useTranslations("language");
  return (
    <LanguageMenu
      current={locale}
      path={path}
      label={t("button", { language: ENDONYMS[locale] })}
      menuLabel={t("menu")}
      className="pointer-events-auto -me-1.5 rounded-lg bg-zinc-950/60 text-sm backdrop-blur-sm"
    />
  );
}
