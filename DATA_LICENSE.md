# Data license

Code in this repository is MIT. See [LICENSE](LICENSE).

Neuron data is not MIT. Every neuron mesh, graph, and annotation this project displays comes from the Janelia **MaleCNS v1.0** connectome, licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

The dataset is released by the FlyEM Project Team at HHMI Janelia Research Campus, with the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research. The public site is [male-cns.janelia.org](https://male-cns.janelia.org/). neuPrint dataset id: `male-cns:v1.0`.

## Required attribution

If you redistribute the data, or a baked subset of it (`glTF`, `graph.bin`, `neurons.json`, or anything derived from MaleCNS), you must:

1. Credit the MaleCNS v1.0 dataset and the people who produced it.
2. Link to the CC BY 4.0 license.
3. Indicate if you changed the data.
4. Cite the paper:

> Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2026). Sexual dimorphism in the complete _Drosophila_ male central nervous system connectome. _Cell_ 189, 5504–5526.e15. https://doi.org/10.1016/j.cell.2026.08.015

Suggested credit line:

> Neuron data from MaleCNS v1.0 (HHMI Janelia FlyEM, University of Cambridge, MRC Laboratory of Molecular Biology, and Google Research), licensed under CC BY 4.0. https://male-cns.janelia.org/

Raw downloads and baked assets are not stored in git. Baked files are published as GitHub Releases tagged `data-v1`, `data-v2`, and so on. `data.lock.json` pins the tag and the sha256 of each file. `pnpm data:fetch` downloads that set into `apps/web/public/data/`, which is gitignored.
