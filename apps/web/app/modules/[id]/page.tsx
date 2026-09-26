import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return {
    title: `${entry.lesson.title} · Neurofly`,
    description: entry.lesson.summary,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const entry = findLesson((await params).id);
  if (!entry) notFound();
  return <Viewer lessonId={entry.id} />;
}
