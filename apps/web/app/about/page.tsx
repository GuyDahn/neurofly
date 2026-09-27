import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteCopy } from "@/src/site/copy";
import { SiteFooter } from "@/src/site/footer";
import { SiteHeader } from "@/src/site/header";
import { pageMetadata } from "@/src/site/page-meta";
import { LINK_CLASS, RichText, SiteLink } from "@/src/site/rich-text";
import { AUTHOR } from "@/src/site/site";
import type { Rich } from "@/src/site/text";

const copy = siteCopy();

export const metadata: Metadata = pageMetadata({
  title: copy.meta.aboutTitle,
  description: copy.meta.aboutDescription,
  path: "/about",
});

export default function AboutPage() {
  const { about, support, a11y } = copy;
  const { real } = about;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {about.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-300">
          {about.lead}
        </p>
        <nav
          aria-label="On this page"
          className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400"
        >
          <a href={`#${real.id}`} className={LINK_CLASS}>
            {real.title}
          </a>
          <a href={`#${about.who.id}`} className={LINK_CLASS}>
            {about.who.title}
          </a>
          <a href={`#${about.support.id}`} className={LINK_CLASS}>
            {about.support.title}
          </a>
        </nav>

        <Section id={real.id} title={real.title}>
          <SubTitle>{real.realTitle}</SubTitle>
          <Points items={real.realItems} newTab={a11y.newTab} />
          <SubTitle>{real.simplifiedTitle}</SubTitle>
          <Points items={real.simplifiedItems} newTab={a11y.newTab} />
          <SubTitle>{real.researchTitle}</SubTitle>
          <Bullets items={real.researchItems} newTab={a11y.newTab} />
          <SubTitle>{real.furtherTitle}</SubTitle>
          <Bullets items={real.further} newTab={a11y.newTab} />
        </Section>

        <Section id={about.who.id} title={about.who.title}>
          <p className="text-base leading-relaxed text-zinc-300">
            {about.who.body}
          </p>
          <p className="flex flex-wrap gap-x-2 text-base text-zinc-200">
            <SiteLink href={about.who.github.href} newTab={a11y.newTab}>
              {about.who.github.text}
            </SiteLink>
            {AUTHOR.linkedin ? (
              <>
                <span aria-hidden="true">·</span>
                <SiteLink href={AUTHOR.linkedin} newTab={a11y.newTab}>
                  {about.who.linkedin}
                </SiteLink>
              </>
            ) : null}
          </p>
        </Section>

        <Section id={about.support.id} title={about.support.title}>
          <p className="text-base leading-relaxed text-zinc-300">
            {support.pitch}
          </p>
          <p className="text-base text-zinc-200">
            <SiteLink href={support.coffee.href} newTab={a11y.newTab}>
              {support.coffee.text}
            </SiteLink>
          </p>
        </Section>

        <Section id="privacy" title={about.privacy.title}>
          <p className="text-base leading-relaxed text-zinc-300">
            {about.privacy.body}
          </p>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mt-14 flex scroll-mt-6 flex-col gap-4 border-t border-white/10 pt-10"
    >
      <h2
        id={`${id}-title`}
        className="text-2xl font-semibold tracking-tight text-zinc-50"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-4 text-sm font-semibold tracking-[0.14em] text-zinc-400 uppercase">
      {children}
    </h3>
  );
}

function Points({
  items,
  newTab,
}: {
  items: readonly { title: string; body: Rich }[];
  newTab: string;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li
          key={item.title}
          className="text-base leading-relaxed text-zinc-300"
        >
          <strong className="font-semibold text-zinc-50">{item.title}</strong>{" "}
          <RichText parts={item.body} newTab={newTab} />
        </li>
      ))}
    </ul>
  );
}

function Bullets({
  items,
  newTab,
}: {
  items: readonly Rich[];
  newTab: string;
}) {
  return (
    <ul className="flex list-disc flex-col gap-2.5 pl-5 marker:text-zinc-600">
      {items.map((item, index) => (
        <li key={index} className="text-base leading-relaxed text-zinc-300">
          <RichText parts={item} newTab={newTab} />
        </li>
      ))}
    </ul>
  );
}
