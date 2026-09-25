import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLockedAssets, readLock } from "./data-lock.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const lock = await readLock(path.join(root, "data.lock.json"));
const destination = path.join(root, "apps", "web", "public", "data");
const written = await fetchLockedAssets({ lock, destination });

if (written.length === 0) {
  console.log(
    `No assets pinned for ${lock.version}. Nothing to download into apps/web/public/data/.`,
  );
} else {
  for (const filePath of written) {
    console.log(`Fetched ${path.relative(root, filePath)}`);
  }
}
