import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { LessonModule } from "./lesson.js";
import type { ModuleSpec } from "./types.js";

/** Names and button descriptions for a circuit's groups, from circuits.<circuit>. */
export function useCircuitCopy(module: ModuleSpec) {
  const t = useTranslations(`circuits.${module.circuit}`);
  return {
    name: (colorGroup: string) => t(`groups.${colorGroup}`),
    stimulate: (colorGroup: string) => t(`stimulate.${colorGroup}`),
    silence: (colorGroup: string) => t(`silence.${colorGroup}`),
  };
}

/** Each jargon term in bold, its gloss as a quiet aside. */
const GLOSS = {
  term: (chunks: ReactNode) => (
    <strong className="font-semibold text-white">{chunks}</strong>
  ),
  gloss: (chunks: ReactNode) => <span className="text-zinc-400">{chunks}</span>,
};

/** A lesson's words, from lessons.<id>, with its <term> and <gloss> markup drawn. */
export function useLessonCopy(lesson: LessonModule) {
  const t = useTranslations(`lessons.${lesson.id}`);
  return {
    plain: (key: string) => t(key),
    rich: (key: string) => t.rich(key, GLOSS),
  };
}
