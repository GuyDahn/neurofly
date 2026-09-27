import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

let shallowTips: Set<string> | null = null;

/**
 * Commits a shallow clone cut off at. Git reports them as having added every
 * file, so a date from one of them says nothing about when a file changed.
 */
function shallowBoundary(): Set<string> {
  if (shallowTips) return shallowTips;
  shallowTips = new Set();
  if (git(["rev-parse", "--is-shallow-repository"]) !== "true") {
    return shallowTips;
  }
  const file = git(["rev-parse", "--git-path", "shallow"]);
  try {
    for (const line of readFileSync(file ?? "", "utf8").split("\n")) {
      if (line.trim()) shallowTips.add(line.trim());
    }
  } catch {
    // No list of cut-off commits: trust nothing from this clone.
    shallowTips.add("*");
  }
  return shallowTips;
}

const cache = new Map<string, string | null>();

/**
 * When any of these files (paths from the app folder) last changed, as the
 * committer date of the newest commit that touched them. Null when git
 * cannot say for sure, in which case the sitemap leaves lastmod out rather
 * than guess.
 */
export function lastModified(files: readonly string[]): string | null {
  const key = files.join("\n");
  if (cache.has(key)) return cache.get(key)!;
  const out = git(["log", "-1", "--format=%H %cI", "--", ...files]);
  let date: string | null = null;
  if (out) {
    const [commit = "", when = ""] = out.split(" ");
    const boundary = shallowBoundary();
    if (!boundary.has("*") && !boundary.has(commit)) date = when || null;
  }
  cache.set(key, date);
  return date;
}

/** The latest of several ISO dates, or null if none is known. */
export function latest(dates: readonly (string | null)[]): string | null {
  let best: string | null = null;
  for (const date of dates) {
    if (date && (!best || Date.parse(date) > Date.parse(best))) best = date;
  }
  return best;
}
