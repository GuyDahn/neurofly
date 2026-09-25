import { findOversizedStagedFiles } from "./asset-size.js";

const problems = findOversizedStagedFiles(process.cwd());
if (problems.length > 0) {
  console.error(
    "Refusing to commit baked assets over the .gitattributes size limit:",
  );
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  console.error(
    "Publish glTF and graph.bin on a data-vN GitHub Release instead.",
  );
  process.exit(1);
}
