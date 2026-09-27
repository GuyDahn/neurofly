import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonCredits } from "@/src/site/footer";
import { pageMetadata } from "@/src/site/page-meta";
import { findLesson, LESSONS } from "@/src/viewer/modules";
import { Viewer } from "@/src/viewer/viewer";

type Params = { id: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return LESSONS.map((entry) => ({ id: entry.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const entry = findLesson((await params).id);
  if (!entry) return {};
  return pageMetadata({
    title: entry.lesson.title,
    description: entry.lesson.summary,
    path: entry.path,
  });
}

export default async function LessonPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const entry = findLesson((await params).id);
  if (!entry) notFound();
  // The data's makers are credited where their neurons are shown. No coffee
  // link here: nothing asks students for anything mid-lesson.
  return <Viewer lessonId={entry.id} credit={<LessonCredits />} />;
}
