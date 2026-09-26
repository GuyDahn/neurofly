# Data tooling

`uv run --directory tools/data make-data` rebuilds the classroom subcircuits from the MaleCNS v1.0 flat files.

1. Download `body-annotations`, `body-neurotransmitters`, and `connectome-weights` into `raw/` and check each MD5 against the public GCS object listing.
2. Read body id, type, superclass, and consensus neurotransmitter. A seed in `seeds.yaml` that matches zero neurons aborts the run.
3. Extract olfactory, visual-navigation, and escape subgraphs (2,000–5,000 neurons). The cap keeps the strongest synapses and round-robins across seed groups.
4. Write `graph.bin` (little-endian `NFLY` header, then `src u32`, `dst u32`, `weight i16`, presynaptic `nt sign i8`, pad) and `neurons.json` (`id`, `type`, plain-English `label`, `colorGroup`).
5. Download SWC skeletons, simplify them to tubes, and Draco-compress one glTF per circuit under 15 MB.

`raw/` and `dist/` are gitignored. Publish `dist/` with the command in [release.md](release.md). `pnpm data:fetch` then checks the sha256 values in the repo-root `data.lock.json`.

`uv run --directory tools/data compass-cells` prints the cells the heading lesson drives: P-EN2 turn neurons split by protocerebral bridge side, and E-PG compass neurons in their 16 ellipsoid body wedges, each with its angle measured from the SWC skeletons as seen from behind the fly. `neurons.json` keeps cell types but not sides, so `apps/web/content/visual/module.json` lists those body ids.

Seed type names are in `seeds.yaml`. Change them after looking at the [Cell Type Explorer](https://male-cns.janelia.org/); a name that matches nothing fails the build.
