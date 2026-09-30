import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { pageLocale, type LocaleParams } from "@/src/i18n/server";
import { pick, type MessageTree } from "@/src/i18n/messages";
import { shareCard } from "@/src/og/share-card";
import { LessonCredits } from "@/src/site/footer";
import { SiteMenu } from "@/src/site/header";
import { jsonLdScript, lessonJsonLd, pageJsonLd } from "@/src/site/json-ld";
import { pageMetadata, shareImagePath } from "@/src/site/page-meta";
import { SITE_NAME } from "@/src/site/site";
import { findLesson, LESSONS } from "@/src/viewer/modules";
import { Viewer } from "@/src/viewer/viewer";

type Params = LocaleParams & { id: string };

export function generateStaticParams(): { id: string }[] {
  return LESSONS.map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const locale = await pageLocale(params);
  const entry = findLesson((await params).id);
  if (!entry) return {};
  const t = await getTranslations({ locale });
  const card = await shareCard(locale, `lesson-${entry.id}`);
  const title = t(`lessons.${entry.id}.title`);
  return pageMetadata({
    locale,
    path: entry.path,
    title: t("meta.lessonTitle", { title }),
    shareTitle: title,
    description: t(`lessons.${entry.id}.description`),
    image: shareImagePath(locale, `lesson-${entry.id}`, card.version),
    imageAlt: card.alt,
  });
}

export default async function LessonPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const locale = await pageLocale(params);
  setRequestLocale(locale);
  const entry = findLesson((await params).id);
  if (!entry) notFound();
  const t = await getTranslations({ locale });
  const circuit = entry.module.circuit;
  // The viewer runs in the browser, so it gets only what it says: its own
  // controls, this lesson, this circuit's names, and the other lessons'
  // titles for the lesson menu.
  const messages = pick((await getMessages()) as MessageTree, [
    "viewer",
    "language",
    "translate",
    ...LESSONS.map((other) => `lessons.${other.id}.title`),
    `lessons.${entry.id}`,
    `circuits.${circuit}`,
  ]);
  const title = t(`lessons.${entry.id}.title`);
  return (
    <>
      <NextIntlClientProvider messages={messages}>
        {/* The data's makers are credited where their neurons are shown. No
            coffee link here: nothing asks students for anything mid-lesson. */}
        <Viewer
          lessonId={entry.id}
          credit={<LessonCredits locale={locale} />}
          menu={
            <SiteMenu
              locale={locale}
              path={entry.path}
              className="pointer-events-auto -me-1.5 shrink-0"
              buttonClassName="bg-zinc-950/60 text-zinc-200 backdrop-blur-sm hover:text-white focus-visible:outline-white"
            />
          }
        />
      </NextIntlClientProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            pageJsonLd(
              locale,
              [
                { name: SITE_NAME, path: "/" },
                { name: title, path: entry.path },
              ],
              lessonJsonLd({
                locale,
                path: entry.path,
                name: title,
                description: t(`lessons.${entry.id}.description`),
                teaches: t(`lessons.${entry.id}.summary`),
                educationalLevel: t("jsonLd.educationalLevel"),
                learningResourceType: t("jsonLd.learningResourceType"),
                audience: t("jsonLd.audience"),
                keywords: entry.module.groups.map((group) =>
                  t(`circuits.${circuit}.groups.${group.colorGroup}`),
                ),
              }),
            ),
          ),
        }}
      />
    </>
  );
}
