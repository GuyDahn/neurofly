import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CASCADE_FILE,
  type CascadeFile,
  type CascadeGroup,
} from "./cascade.js";

export type CascadeSummary = {
  /** Versioned URL: a hash of the file, so it can be cached for a year and still change with a rebake. */
  url: string;
  groups: CascadeGroup[];
  tickMs: number;
  /** The file itself, for the share images. */
  raw: string;
};

let pending: Promise<CascadeSummary | null> | null = null;

/**
 * The baked landing loop, which sits next to the circuit files. Null when the
 * build had no data. Read once per build, however many pages and languages
 * ask.
 */
export function readCascadeFile(): Promise<CascadeSummary | null> {
  pending ??= readFile(
    path.join(process.cwd(), "public", "data", CASCADE_FILE),
    "utf8",
  ).then(
    (raw) => {
      const file = JSON.parse(raw) as CascadeFile;
      const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
      return {
        url: `/data/${CASCADE_FILE}?v=${hash}`,
        groups: file.groups,
        tickMs: file.tickMs,
        raw,
      };
    },
    () => null,
  );
  return pending;
}
