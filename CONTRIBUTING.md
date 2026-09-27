# Contributing

This repository is public from the first commit. Write as if a stranger will read the diff.

## Setup

```bash
pnpm install
uv sync --directory tools/data
```

`pnpm install` copies the git hooks in `.githooks/` into `.git/hooks`. You need [gitleaks](https://github.com/gitleaks/gitleaks#installing) on your `PATH` before you commit. The pre-commit hook runs gitleaks and rejects staged `*.glb` and `*.bin` files larger than 1 MiB (the `max-size` attribute in `.gitattributes`).

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/). `commitlint` checks the message.

## Data

Do not commit neuron data, raw downloads, `.env` files, or baked assets. `tools/data/raw/` and `apps/web/public/data/` are gitignored. Publish baked `glTF`, `graph.bin`, and `neurons.json` as a GitHub Release tagged `data-v1`, `data-v2`, and so on, then pin the file names and sha256 digests in `data.lock.json`.

## Translations

WiredMind is written in 18 languages. Each language is one file, [`apps/web/messages/<locale>.json`](apps/web/messages/), with exactly the keys of `en.json`. Every string on the site, in the lessons, on the share images, and in search results comes from that file, so fixing a language never means touching code.

Messages use [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/): keep every `{placeholder}` and every `<tag>…</tag>` as it is, write every plural form your language has, and translate everything else. In lessons, `<term>` marks a scientific name and `<gloss>` the short nickname in parentheses after it.

**Fix a string.** Edit the language's file, run `pnpm i18n:check --locale <locale>`, and open a pull request. To see it in place, run `pnpm dev` and open `http://localhost:3000/<locale>`. The share images' fonts are stored in the repo with only the characters the cards use, so the build never waits on the network; if the check says they lack a character you added, run `pnpm og:fonts` and commit what it writes to `apps/web/src/og/fonts/`.

**Review a language.** Machine drafts are marked `"_meta": { "reviewed": false }`. A native speaker reads the whole language in the running site, fixes what reads wrong, and sets `reviewed` to `true` in the same pull request. When a reviewed file later gets new drafted keys, they are listed in `_meta.unreviewedKeys`: review them and delete them from the list. `pnpm i18n:check --unreviewed` lists every key still waiting for a reviewer.

**The glossary.** [`apps/web/i18n/glossary.json`](apps/web/i18n/glossary.json) holds the accepted translation of each scientific term in each language (Kenyon cell, mushroom body, giant fiber, projection neuron, and more) and the names that are never translated: `WiredMind`, `MaleCNS`, and the cell type codes. The checker holds every language to it. To change a term, change it in the glossary rather than in one messages file, and say in the pull request which textbook or paper in that language uses it. [`apps/web/i18n/style-guide.json`](apps/web/i18n/style-guide.json) says how each language talks to students (tu or vous, du or Sie, and so on).

**Add a language.**

1. Draft it with `pnpm i18n:draft <locale>`. It sends English, the glossary, and the style guide to Claude (`claude-opus-5`) with the Anthropic API, checks every answer with the same rules as `pnpm i18n:check`, asks again for anything that fails, and writes the file marked unreviewed. It needs `ANTHROPIC_API_KEY` (or `ant auth login`) and costs a few dollars of API use per language. `--dry-run` shows what it would send, and `--print-prompt` prints the instructions, which also work for translating by hand.
2. Run `pnpm i18n:check --locale <locale>` until it passes.
3. In [`apps/web/src/i18n/locales.ts`](apps/web/src/i18n/locales.ts), move the locale from `FALLBACK_LOCALES` to `LOCALES` and add its entries to `ENDONYMS` and `OG_LOCALES`. If its script needs its own font on the share images, add it in [`apps/web/src/og/families.ts`](apps/web/src/og/families.ts). Then run `pnpm og:fonts` to fetch the fonts its share images need. Right-to-left languages already in `RTL_LOCALES` flip on their own.
4. Open a pull request with the `translation` label. It goes live once a native speaker has reviewed it.

Until then, the language's URLs (`/fa/about`) serve the English page with a note asking for help, and stay out of search results.

**What `pnpm i18n:check` enforces**, in CI as part of `pnpm lint`: the same keys as English and no others; valid ICU with the same placeholders, the same tags, and every plural form the language has; the glossary's terms, the brand, and the kept names; every number from the English, as digits; search titles within 60 characters and descriptions within 155 (a Chinese, Japanese, or Korean character counts as two); share-image fonts that can draw every character on the cards; and no string left in English. [Open an issue](https://github.com/GuyDahn/wiredmind-edu/issues/new?template=translation.yml) to report a translation or offer to review one.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

GitHub Actions runs the same checks on every push.
