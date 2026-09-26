import escapeCircuit from "../../content/escape/module.json" with { type: "json" };
import compassLesson from "../../content/modules/compass.json" with { type: "json" };
import escapeLesson from "../../content/modules/escape.json" with { type: "json" };
import smellMemoryLesson from "../../content/modules/smell-memory.json" with { type: "json" };
import olfactoryCircuit from "../../content/olfactory/module.json" with { type: "json" };
import visualCircuit from "../../content/visual/module.json" with { type: "json" };
import { readLesson, type LessonModule } from "./lesson.js";
import { readModule } from "./module.js";
import type { ModuleSpec } from "./types.js";

export type LessonEntry = {
  /** Lesson id. Share links carry it. */
  id: string;
  /** Position in the course, from 1. */
  number: number;
  /** Page the lesson lives on. */
  path: string;
  module: ModuleSpec;
  lesson: LessonModule;
};

function entry(
  number: number,
  path: string,
  circuit: unknown,
  lesson: unknown,
): LessonEntry {
  const spec = readModule(circuit);
  const read = readLesson(lesson, spec);
  return { id: read.id, number, path, module: spec, lesson: read };
}

export const LESSONS: readonly LessonEntry[] = [
  entry(1, "/", olfactoryCircuit, smellMemoryLesson),
  entry(2, "/modules/compass", visualCircuit, compassLesson),
  entry(3, "/modules/escape", escapeCircuit, escapeLesson),
];

export function findLesson(id: string): LessonEntry | undefined {
  return LESSONS.find((item) => item.id === id);
}
