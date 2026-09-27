import type { Metadata } from "next";
import Link from "next/link";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { localePath } from "@/src/i18n/locales";
import { pageLocale, type LocaleParams } from "@/src/i18n/server";
import { CASCADE_SPAN_MS, FLY_MS_PER_WALL_MS } from "@/src/site/cascade";
import { readCascadeFile } from "@/src/site/cascade-file";
import { EscapeLoop, type LoopStep } from "@/src/site/escape-loop";
import { SiteFooter } from "@/src/site/footer";
import { SiteHeader } from "@/src/site/header";
import { homeJsonLd, jsonLdScript } from "@/src/site/json-ld";
import { pageMetadata, shareImagePath } from "@/src/site/page-meta";
import {
  ForwardArrow,
  LINK_CLASS,
  richLinks,
  SiteLink,
} from "@/src/site/rich-text";
import { shareCard } from "@/src/og/share-card";
import { PAPER, REPO_URL } from "@/src/site/site";
import { findLesson, LESSONS } from "@/src/viewer/modules";

const TEACHER_POINTS = [
  "periods",
  "install",
  "free",
  "open",
  "share",
  "honest",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale });
  const card = await shareCard(locale, "home");
  return pageMetadata({
    locale,
    path: "/",
    title: t("meta.home.title"),
    shareTitle: t("meta.home.title"),
    description: t("meta.home.description"),
    image: shareImagePath(locale, "home", card.version),
    imageAlt: card.alt,
  });
}

const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function HomePage({
  params,
}: {
  params: Promise<LocaleParams>;
}) {
  const locale = await pageLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const format = await getFormatter({ locale });
  const links = richLinks(locale, t("a11y.newTab"));
  const newTab = t("a11y.newTab");
  const cascade = await readCascadeFile();
  const escape = findLesson("escape");
  const steps: LoopStep[] =
    escape?.module.groups.map((group) => {
      const baked = cascade?.groups.find(
        (item) => item.colorGroup === group.colorGroup,
      );
      let detail = "";
      if (baked && cascade) {
        const cells = t("landing.loop.cells", { count: baked.count });
        detail =
          baked.firstTick === null
            ? cells
            : t("landing.loop.firstSpike", {
                cells,
                ms: format.number(baked.firstTick * cascade.tickMs, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
              });
      }
      return {
        colorGroup: group.colorGroup,
        color: group.color,
        label: t(`landing.loop.steps.${group.colorGroup}`),
        detail,
      };
    }) ?? [];
  const first = LESSONS[0];

  return (
    <>
      <SiteHeader locale={locale} path="/" />
      <main id="main">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_60%_at_75%_20%,rgb(56_189_248/0.12),transparent),radial-gradient(40%_40%_at_20%_60%,rgb(248_113_113/0.08),transparent)] rtl:-scale-x-100"
          />
          {/* Phones read the hook, watch the loop, then act. Wide screens put the loop beside the words. */}
          <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-16 [grid-template-areas:'title'_'loop'_'body'] sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12 lg:gap-y-6 lg:pt-16 lg:pb-24 lg:[grid-template-areas:'title_loop'_'body_loop']">
            <div className="flex flex-col gap-5 [grid-area:title] lg:self-end">
              <p className="text-xs font-semibold tracking-[0.16em] text-sky-600 uppercase dark:text-sky-300">
                {t("landing.hero.eyebrow")}
              </p>
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-fg sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                {t("landing.hero.title")}
              </h1>
            </div>
            <div className="flex flex-col gap-6 [grid-area:body] lg:self-start">
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-fg-muted">
                {t("landing.hero.lead")}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {first ? (
                  <Link
                    href={localePath(locale, first.path)}
                    className={`${BUTTON} bg-accent text-accent-fg hover:bg-accent-hover`}
                  >
                    {t("landing.hero.start")}
                  </Link>
                ) : null}
                <Link
                  href="#teachers"
                  className={`${BUTTON} border border-border-strong text-fg-muted hover:bg-overlay`}
                >
                  {t("landing.hero.teachers")}
                </Link>
              </div>
            </div>
            <div className="[grid-area:loop] lg:self-center">
              <EscapeLoop
                src={cascade?.url ?? null}
                steps={steps}
                locale={locale}
                copy={{
                  label: t("landing.loop.label"),
                  clock: t("landing.loop.clock", { ms: "{ms}" }),
                  waiting: t("landing.loop.waiting"),
                  pause: t("landing.loop.pause"),
                  play: t("landing.loop.play"),
                  loading: t("landing.loop.loading"),
                  failed: t("landing.loop.failed"),
                }}
                caption={t.rich("landing.loop.caption", {
                  ...links,
                  spanMs: CASCADE_SPAN_MS,
                  slowdown: Math.round(1 / FLY_MS_PER_WALL_MS),
                })}
              />
            </div>
          </div>
        </section>

        <section
          id="lessons"
          aria-labelledby="lessons-title"
          className="scroll-mt-4 border-t border-border"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2
              id="lessons-title"
              className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl"
            >
              {t("landing.lessons.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
              {t("landing.lessons.lead")}
            </p>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {LESSONS.map((entry) => (
                <li
                  key={entry.id}
                  className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-overlay p-5 transition-colors focus-within:border-border-strong hover:border-border-strong hover:bg-overlay-strong"
                >
                  <p className="text-xs font-semibold tracking-[0.14em] text-fg-subtle uppercase">
                    {t("landing.lessons.lesson", { number: entry.number })}
                  </p>
                  <h3 className="text-xl leading-snug font-semibold text-fg">
                    <Link
                      href={localePath(locale, entry.path)}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                    >
                      {t(`lessons.${entry.id}.title`)}
                    </Link>
                  </h3>
                  <p className="text-base leading-snug text-fg-muted">
                    {t(`lessons.${entry.id}.summary`)}
                  </p>
                  <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-fg-subtle">
                    {entry.module.groups.map((group) => (
                      <li
                        key={group.colorGroup}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        {t(
                          `circuits.${entry.module.circuit}.groups.${group.colorGroup}`,
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                    <span className="text-fg-subtle">
                      {t("landing.lessons.meta", {
                        steps: entry.lesson.steps.length,
                      })}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-semibold whitespace-nowrap text-fg-muted group-hover:text-fg"
                    >
                      {t("landing.lessons.start", { number: entry.number })}{" "}
                      <ForwardArrow />
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="teachers"
          aria-labelledby="teachers-title"
          className="scroll-mt-4 border-t border-border bg-overlay"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2
              id="teachers-title"
              className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl"
            >
              {t("landing.teachers.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
              {t("landing.teachers.lead")}
            </p>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {TEACHER_POINTS.map((point) => (
                <li key={point} className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-fg">
                    {t(`landing.teachers.points.${point}.title`)}
                  </h3>
                  <p className="text-base leading-relaxed text-fg-muted">
                    {t(`landing.teachers.points.${point}.body`)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <SiteLink
                href={REPO_URL}
                newTab={newTab}
                className={`${BUTTON} gap-2 border border-border-strong text-fg-muted hover:bg-overlay`}
              >
                <GitHubIcon />
                {t("landing.teachers.source")}
              </SiteLink>
              <Link
                href={`${localePath(locale, "/about")}#real-and-simplified`}
                className={`${LINK_CLASS} self-start text-base text-fg-muted sm:self-auto`}
              >
                {t("landing.teachers.science")}
              </Link>
            </div>
          </div>
        </section>

        <section
          id="credits"
          aria-labelledby="credits-title"
          className="scroll-mt-4 border-t border-border"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2
              id="credits-title"
              className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl"
            >
              {t("credits.title")}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-fg-muted">
              {t.rich("credits.body", links)}
            </p>
            <blockquote
              lang="en"
              dir="ltr"
              className="mt-6 max-w-3xl border-s-2 border-border-strong ps-4 text-sm leading-relaxed text-fg-muted"
            >
              {PAPER.citation}{" "}
              <SiteLink href={PAPER.url} newTab={newTab}>
                doi:{PAPER.doi}
              </SiteLink>
            </blockquote>
            <p className="mt-6 max-w-3xl text-sm leading-relaxed text-fg-subtle">
              {t.rich("credits.license", links)}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            homeJsonLd({ locale, description: t("meta.home.description") }),
          ),
        }}
      />
    </>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
