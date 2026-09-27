import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  {
    settings: {
      next: {
        rootDir: "apps/web",
      },
    },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "apps/web/public/data/**",
      "apps/web/public/draco/**",
      "tools/data/**",
      "pnpm-lock.yaml",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Share images render through Satori, which takes plain <img> and cannot
    // use next/image. The Next plugin only exempts these files when ESLint
    // runs from the app folder, not from the repo root.
    files: ["apps/web/app/**/{opengraph-image,twitter-image}.tsx"],
    rules: { "@next/next/no-img-element": "off" },
  },
];

export default eslintConfig;
