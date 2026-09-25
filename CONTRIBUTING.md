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

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

GitHub Actions runs the same checks on every push.
