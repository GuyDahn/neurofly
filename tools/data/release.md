# Publish data-v1

Run this from the repository root after `uv run --directory tools/data make-data`. The files live in `tools/data/dist/`, which is gitignored. `data.lock.json` already pins their sha256 values. Do not rename the assets: `pnpm data:fetch` downloads each name from this release.

```bash
gh release create data-v1 \
  --repo GuyDahn/wiredmind-edu \
  --title "data-v1" \
  --notes "MaleCNS v1.0 classroom subcircuits (olfactory, visual navigation, escape). CC BY 4.0. Skeletons are simplified and Draco-compressed; synapse counts are the anatomical weights." \
  tools/data/dist/escape.glb \
  tools/data/dist/escape.graph.bin \
  tools/data/dist/escape.neurons.json \
  tools/data/dist/olfactory.glb \
  tools/data/dist/olfactory.graph.bin \
  tools/data/dist/olfactory.neurons.json \
  tools/data/dist/visual.glb \
  tools/data/dist/visual.graph.bin \
  tools/data/dist/visual.neurons.json
```

Then `pnpm data:fetch` pulls those nine files into `apps/web/public/data/` and checks the sha256 in `data.lock.json`.
