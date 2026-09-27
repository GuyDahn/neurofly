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
    files: [
      "apps/web/app/**/{opengraph-image,twitter-image}.tsx",
      "apps/web/app/{og,icons}/**/route.tsx",
      "apps/web/src/og/**/*.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    // Every word a reader sees comes from apps/web/messages, so no JSX text
    // in the pages or components may be written in English (or anything
    // else). Punctuation that means the same in every language is allowed.
    files: [
      "apps/web/app/**/*.tsx",
      "apps/web/src/site/**/*.tsx",
      "apps/web/src/viewer/**/*.tsx",
    ],
    ignores: ["apps/web/app/sim-bench/**"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { allowedStrings: ["·", "→", "↑", "%", "doi:"] },
      ],
    },
  },
];

export default eslintConfig;
