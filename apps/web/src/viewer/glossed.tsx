import { useMemo } from "react";
import { glossParts } from "./lesson.js";

/** Lesson copy with each jargon term in bold and its gloss as a quiet aside. */
export function Glossed({
  text,
  jargon,
}: {
  text: string;
  jargon: readonly string[];
}) {
  const parts = useMemo(() => glossParts(text, jargon), [text, jargon]);
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "term") {
          return (
            <strong key={index} className="font-semibold text-white">
              {part.value}
            </strong>
          );
        }
        if (part.kind === "gloss") {
          return (
            <span key={index} className="text-zinc-400">
              {part.value}
            </span>
          );
        }
        return part.value;
      })}
    </>
  );
}
