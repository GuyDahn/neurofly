import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditLine } from "@/src/site/footer";
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
    title: entry.lesson.title,
    description: entry.lesson.summary,
    alternates: { canonical: entry.path },
    openGraph: {
      title: entry.lesson.title,
      description: entry.lesson.summary,
      url: entry.path,
    },
    twitter: {
      title: entry.lesson.title,
      description: entry.lesson.summary,
    },
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const entry = findLesson((await params).id);
  if (!entry) notFound();
  // No coffee link here: nothing asks students for anything mid-lesson.
  return <Viewer lessonId={entry.id} credit={<CreditLine coffee={false} />} />;
}
