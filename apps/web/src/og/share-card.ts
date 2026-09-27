import { createHash } from "node:crypto";
import { getTranslations } from "next-intl/server";
import type { Locale } from "../i18n/locales.js";
import type { SharePage } from "../site/page-meta.js";
import { findLesson, LESSONS } from "../viewer/modules.js";

/** Bump when the card's design changes, so every cached share image refreshes. */
const DESIGN = 1;

export type ShareCard = {
  title: string;
  subtitle: string;
  /** "Lesson 2 of 3" above the title, on lesson cards. */
  label: string | null;
  alt: string;
  /** Changes whenever the card would, so social sites fetch the new image. */
  version: string;
};

export const SHARE_PAGES: readonly SharePage[] = [
  "home",
  "about",
  ...LESSONS.map((entry) => `lesson-${entry.id}` as const),
];

/** What a page's share image says, in one language. */
export async function shareCard(
  locale: Locale,
  page: SharePage,
): Promise<ShareCard> {
  const t = await getTranslations({ locale });
  let title: string;
  let subtitle: string;
  let label: string | null = null;
  if (page === "home" || page === "about") {
    title = t(`og.${page}.title`);
    subtitle = t(`og.${page}.subtitle`);
  } else {
    const entry = findLesson(page.slice("lesson-".length));
    if (!entry) throw new Error(`No lesson for share card ${page}`);
    title = t(`lessons.${entry.id}.title`);
    subtitle = t(`lessons.${entry.id}.summary`);
    label = t("og.lessonLabel", {
      number: entry.number,
      total: LESSONS.length,
    });
  }
  const version = createHash("sha256")
    .update(JSON.stringify([DESIGN, locale, title, subtitle, label]))
    .digest("hex")
    .slice(0, 10);
  return { title, subtitle, label, alt: t("og.alt", { title }), version };
}
