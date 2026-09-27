import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { CASCADE_FILE } from "@/src/site/cascade";
import { siteCopy } from "@/src/site/copy";
import { EscapeLoop } from "@/src/site/escape-loop";
import { SiteFooter } from "@/src/site/footer";
import { SiteHeader } from "@/src/site/header";
import { LINK_CLASS, RichText, SiteLink } from "@/src/site/rich-text";
import { fill } from "@/src/site/text";
import { findLesson, LESSONS } from "@/src/viewer/modules";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const BUTTON =
  "inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * The baked loop sits next to the circuit files. Its URL carries a hash of
 * the file, so it can be cached for a year and still change with a rebake.
 */
async function cascadeUrl(): Promise<string | null> {
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "data", CASCADE_FILE),
    );
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    return `/data/${CASCADE_FILE}?v=${hash}`;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const copy = siteCopy();
  const escape = findLesson("escape");
  const steps =
    escape?.module.groups.map((group) => ({
      colorGroup: group.colorGroup,
      color: group.color,
      label: group.label,
    })) ?? [];
  const first = LESSONS[0];

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(60%_60%_at_75%_20%,rgb(56_189_248/0.12),transparent),radial-gradient(40%_40%_at_20%_60%,rgb(248_113_113/0.08),transparent)]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 lg:pt-16 lg:pb-24">
            <div className="flex flex-col gap-6">
              <p className="text-xs font-semibold tracking-[0.16em] text-sky-300 uppercase">
                {copy.hero.eyebrow}
              </p>
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance text-zinc-50 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
                {copy.hero.title}
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-pretty text-zinc-300">
                {copy.hero.lead}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                {first ? (
                  <Link
                    href={first.path}
                    className={`${BUTTON} bg-zinc-50 text-zinc-950 hover:bg-white`}
                  >
                    {copy.hero.start}
                  </Link>
                ) : null}
                <Link
                  href="#teachers"
                  className={`${BUTTON} border border-white/20 text-zinc-100 hover:bg-white/5`}
                >
                  {copy.hero.teachers}
                </Link>
              </div>
            </div>
            <EscapeLoop
              src={await cascadeUrl()}
              steps={steps}
              copy={copy.loop}
              newTab={copy.a11y.newTab}
            />
          </div>
        </section>

        <section
          id="lessons"
          aria-labelledby="lessons-title"
          className="scroll-mt-4 border-t border-white/10"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2
              id="lessons-title"
              className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
            >
              {copy.lessons.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-300">
              {copy.lessons.lead}
            </p>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {LESSONS.map((entry) => (
                <li
                  key={entry.id}
                  className="group relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors focus-within:border-white/30 hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <p className="text-xs font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                    {fill(copy.lessons.lesson, { n: entry.number })}
                  </p>
                  <h3 className="text-xl leading-snug font-semibold text-zinc-50">
                    <Link
                      href={entry.path}
                      className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
                    >
                      {entry.lesson.title}
                    </Link>
                  </h3>
                  <p className="text-base leading-snug text-zinc-300">
                    {entry.lesson.summary}
                  </p>
                  <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-zinc-400">
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
                        {group.label}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                    <span className="text-zinc-400">
                      {fill(copy.lessons.meta, {
                        steps: entry.lesson.steps.length,
                      })}
                    </span>
                    <span
                      aria-hidden="true"
                      className="font-semibold whitespace-nowrap text-zinc-100 group-hover:text-white"
                    >
                      {fill(copy.lessons.start, { n: entry.number })} →
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
          className="scroll-mt-4 border-t border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2
              id="teachers-title"
              className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
            >
              {copy.teachers.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-300">
              {copy.teachers.lead}
            </p>
            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {copy.teachers.points.map((point) => (
                <li key={point.title} className="flex flex-col gap-1.5">
                  <h3 className="text-base font-semibold text-zinc-50">
                    {point.title}
                  </h3>
                  <p className="text-base leading-relaxed text-zinc-300">
                    {point.body}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <SiteLink
                href={copy.teachers.source.href}
                newTab={copy.a11y.newTab}
                className={`${BUTTON} gap-2 border border-white/20 text-zinc-100 hover:bg-white/5`}
              >
                <GitHubIcon />
                {copy.teachers.source.text}
              </SiteLink>
              <Link
                href={copy.teachers.science.href}
                className={`${LINK_CLASS} self-start text-base text-zinc-200 sm:self-auto`}
              >
                {copy.teachers.science.text}
              </Link>
            </div>
          </div>
        </section>

        <section
          id="credits"
          aria-labelledby="credits-title"
          className="scroll-mt-4 border-t border-white/10"
        >
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2
              id="credits-title"
              className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl"
            >
              {copy.credits.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-300">
              <RichText parts={copy.credits.body} newTab={copy.a11y.newTab} />
            </p>
            <blockquote className="mt-6 border-l-2 border-white/20 pl-4 text-sm leading-relaxed text-zinc-300">
              {copy.credits.citation}{" "}
              <SiteLink href={copy.credits.doi.href} newTab={copy.a11y.newTab}>
                {copy.credits.doi.text}
              </SiteLink>
            </blockquote>
            <p className="mt-6 text-sm leading-relaxed text-zinc-400">
              <RichText
                parts={copy.credits.license}
                newTab={copy.a11y.newTab}
              />
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
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
