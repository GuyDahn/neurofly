import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { pageLocale, type LocaleParams } from "@/src/i18n/server";
import { shareCard } from "@/src/og/share-card";
import { SiteFooter } from "@/src/site/footer";
import { SiteHeader } from "@/src/site/header";
import { jsonLdScript, pageJsonLd } from "@/src/site/json-ld";
import { pageMetadata, shareImagePath } from "@/src/site/page-meta";
import { LINK_CLASS, richLinks, SiteLink } from "@/src/site/rich-text";
import { AUTHOR, COFFEE_URL, PAPER, SITE_NAME } from "@/src/site/site";

const REAL = ["neurons", "synapses", "signs", "shapes"] as const;
const SIMPLIFIED = [
  "cuts",
  "model",
  "gaps",
  "learning",
  "stimulation",
  "silence",
  "compass",
  "timing",
  "drawings",
] as const;
const RESEARCH = ["whole", "fit", "add", "drive", "uncertain"] as const;
const FURTHER = ["neuprint", "paper", "shiu", "code"] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleParams>;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale });
  const card = await shareCard(locale, "about");
  return pageMetadata({
    locale,
    path: "/about",
    title: t("meta.about.title"),
    shareTitle: t("meta.about.title"),
    description: t("meta.about.description"),
    image: shareImagePath(locale, "about", card.version),
    imageAlt: card.alt,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<LocaleParams>;
}) {
  const locale = await pageLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const newTab = t("a11y.newTab");
  const links = richLinks(locale, newTab);
  return (
    <>
      <SiteHeader locale={locale} path="/about" />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {t("about.title")}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-300">
          {t("about.lead")}
        </p>
        <nav
          aria-label={t("about.onThisPage")}
          className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-400"
        >
          <a href="#real-and-simplified" className={LINK_CLASS}>
            {t("about.real.title")}
          </a>
          <a href="#credits" className={LINK_CLASS}>
            {t("credits.title")}
          </a>
          <a href="#who-made-this" className={LINK_CLASS}>
            {t("about.who.title")}
          </a>
          <a href="#support" className={LINK_CLASS}>
            {t("about.support.title")}
          </a>
        </nav>

        <Section id="real-and-simplified" title={t("about.real.title")}>
          <SubTitle>{t("about.real.realTitle")}</SubTitle>
          <Points>
            {REAL.map((item) => (
              <Point key={item} title={t(`about.real.realItems.${item}.title`)}>
                {t.rich(`about.real.realItems.${item}.body`, links)}
              </Point>
            ))}
          </Points>
          <SubTitle>{t("about.real.simplifiedTitle")}</SubTitle>
          <Points>
            {SIMPLIFIED.map((item) => (
              <Point
                key={item}
                title={t(`about.real.simplifiedItems.${item}.title`)}
              >
                {t.rich(`about.real.simplifiedItems.${item}.body`, links)}
              </Point>
            ))}
          </Points>
          <SubTitle>{t("about.real.researchTitle")}</SubTitle>
          <Bullets>
            {RESEARCH.map((item) => (
              <li key={item}>{t(`about.real.researchItems.${item}`)}</li>
            ))}
          </Bullets>
          <SubTitle>{t("about.real.furtherTitle")}</SubTitle>
          <Bullets>
            {FURTHER.map((item) => (
              <li key={item}>
                {t.rich(`about.real.furtherItems.${item}`, {
                  ...links,
                  citation: PAPER.citation,
                  // An English reference keeps its own direction in any language.
                  cite: (chunks) => (
                    <bdi lang="en" dir="ltr">
                      {chunks}
                    </bdi>
                  ),
                })}
              </li>
            ))}
          </Bullets>
        </Section>

        <Section id="credits" title={t("credits.title")}>
          <p className="text-base leading-relaxed text-zinc-300">
            {t.rich("credits.body", links)}
          </p>
          <blockquote
            lang="en"
            dir="ltr"
            className="border-s-2 border-white/20 ps-4 text-sm leading-relaxed text-zinc-300"
          >
            {PAPER.citation}{" "}
            <SiteLink href={PAPER.url} newTab={newTab}>
              doi:{PAPER.doi}
            </SiteLink>
          </blockquote>
          <p className="text-sm leading-relaxed text-zinc-400">
            {t.rich("credits.license", links)}
          </p>
        </Section>

        <Section id="who-made-this" title={t("about.who.title")}>
          <p className="text-base leading-relaxed text-zinc-300">
            {t("about.who.body", { author: AUTHOR.name })}
          </p>
          <p className="flex flex-wrap gap-x-2 text-base text-zinc-200">
            <SiteLink href={AUTHOR.github} newTab={newTab}>
              {t("about.who.github")}
            </SiteLink>
            <span aria-hidden="true">·</span>
            <SiteLink href={AUTHOR.website} newTab={newTab}>
              {t("about.who.website")}
            </SiteLink>
          </p>
        </Section>

        <Section id="support" title={t("about.support.title")}>
          <p className="text-base leading-relaxed text-zinc-300">
            {t("support.blurb")}
          </p>
          <p className="text-base text-zinc-200">
            <SiteLink href={COFFEE_URL} newTab={newTab}>
              {t("support.coffee")}
            </SiteLink>
          </p>
        </Section>

        <Section id="privacy" title={t("about.privacy.title")}>
          <p className="text-base leading-relaxed text-zinc-300">
            {t("about.privacy.body")}
          </p>
        </Section>
      </main>
      <SiteFooter locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            pageJsonLd(locale, [
              { name: SITE_NAME, path: "/" },
              { name: t("about.title"), path: "/about" },
            ]),
          ),
        }}
      />
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

function Points({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-4">{children}</ul>;
}

/** A point with a bold lead-in, for lists a reader skims. */
function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="text-base leading-relaxed text-zinc-300">
      <strong className="font-semibold text-zinc-50">{title}</strong> {children}
    </li>
  );
}

function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2.5 ps-5 text-base leading-relaxed text-zinc-300 marker:text-zinc-600">
      {children}
    </ul>
  );
}
