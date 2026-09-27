import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakeCascade } from "./cascade-bake.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const written = await bakeCascade(
  path.join(root, "apps", "web", "public", "data"),
);
console.log(`Baked ${path.relative(root, written)}`);
