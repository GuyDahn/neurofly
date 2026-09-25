import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

const UNIT: Record<string, number> = {
  K: 1024,
  M: 1024 ** 2,
  G: 1024 ** 3,
};

export function parseMaxSize(value: string): number {
  const match = /^(\d+)([KMG])?$/.exec(value.trim());
  if (!match?.[1]) {
    throw new Error(`Invalid max-size attribute: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * (unit ? (UNIT[unit] ?? 1) : 1);
}

export function overLimitMessage(
  filePath: string,
  bytes: number,
  maxSize: string,
): string | undefined {
  const limit = parseMaxSize(maxSize);
  if (bytes > limit) {
    return `${filePath} is ${bytes} bytes, over the ${maxSize} limit in .gitattributes`;
  }
  return undefined;
}

export function stagedPaths(cwd: string): string[] {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACM", "-z"],
    { cwd, encoding: "utf8" },
  );
  return output.split("\0").filter((name) => name.length > 0);
}

export function maxSizeAttribute(
  cwd: string,
  filePath: string,
): string | undefined {
  const output = execFileSync(
    "git",
    ["check-attr", "max-size", "--", filePath],
    {
      cwd,
      encoding: "utf8",
    },
  );
  const value = output.split(": ").at(-1)?.trim();
  if (!value || value === "unspecified" || value === "unset") {
    return undefined;
  }
  return value;
}

export function findOversizedStagedFiles(cwd: string): string[] {
  const problems: string[] = [];
  for (const filePath of stagedPaths(cwd)) {
    const maxSize = maxSizeAttribute(cwd, filePath);
    if (!maxSize) {
      continue;
    }
    const bytes = statSync(filePath).size;
    const message = overLimitMessage(filePath, bytes, maxSize);
    if (message) {
      problems.push(message);
    }
  }
  return problems;
}
