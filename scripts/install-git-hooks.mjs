import { access, chmod, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitHooks = path.join(root, ".git", "hooks");
const source = path.join(root, ".githooks");

try {
  await access(gitHooks);
} catch {
  process.exit(0);
}

for (const name of ["pre-commit", "commit-msg"]) {
  const dest = path.join(gitHooks, name);
  await copyFile(path.join(source, name), dest);
  await chmod(dest, 0o755);
}
