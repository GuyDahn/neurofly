import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type DataLockFile = {
  name: string;
  sha256: string;
};

export type DataLock = {
  version: string;
  repository: string;
  files: DataLockFile[];
};

const VERSION_TAG = /^data-v\d+$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function assertLock(lock: DataLock): void {
  if (!VERSION_TAG.test(lock.version)) {
    throw new Error(
      `data.lock.json version must look like data-v1, got ${lock.version}`,
    );
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(lock.repository)) {
    throw new Error(
      `data.lock.json repository must be owner/name, got ${lock.repository}`,
    );
  }
  for (const file of lock.files) {
    if (!SAFE_NAME.test(file.name)) {
      throw new Error(`Unsafe asset name: ${file.name}`);
    }
    if (!SHA256_HEX.test(file.sha256)) {
      throw new Error(`Asset ${file.name} is missing a sha256 hex digest`);
    }
  }
}

export function assetUrl(lock: DataLock, name: string): string {
  return `https://github.com/${lock.repository}/releases/download/${lock.version}/${name}`;
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readLock(lockPath: string): Promise<DataLock> {
  const parsed: unknown = JSON.parse(await readFile(lockPath, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    !("repository" in parsed) ||
    !("files" in parsed) ||
    !Array.isArray(parsed.files)
  ) {
    throw new Error(`Invalid data lock: ${lockPath}`);
  }
  const lock: DataLock = {
    version: String(parsed.version),
    repository: String(parsed.repository),
    files: parsed.files.map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error(`Invalid asset entry in ${lockPath}`);
      }
      const record = entry as Record<string, unknown>;
      return {
        name: String(record.name),
        sha256: String(record.sha256),
      };
    }),
  };
  assertLock(lock);
  return lock;
}

export async function fetchLockedAssets(options: {
  lock: DataLock;
  destination: string;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  assertLock(options.lock);
  await mkdir(options.destination, { recursive: true });
  if (options.lock.files.length === 0) {
    return [];
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const written: string[] = [];

  for (const file of options.lock.files) {
    const url = assetUrl(options.lock, file.name);
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(
        `Download failed for ${file.name}: ${response.status} ${url}`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = sha256Bytes(bytes);
    if (digest !== file.sha256) {
      throw new Error(
        `sha256 mismatch for ${file.name}: expected ${file.sha256}, got ${digest}`,
      );
    }
    const dest = path.join(options.destination, file.name);
    const partial = `${dest}.partial`;
    await writeFile(partial, bytes);
    await rename(partial, dest);
    written.push(dest);
  }

  return written;
}
