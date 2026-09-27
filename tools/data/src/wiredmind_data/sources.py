"""Official MaleCNS v1.0 flat-connectome objects and their bucket MD5s."""

from __future__ import annotations

BUCKET = "https://storage.googleapis.com/flyem-male-cns"
FLAT_PREFIX = f"{BUCKET}/v1.0/connectome-data/flat-connectome"
SKELETON_URL = (
    f"{BUCKET}/v1.0/segmentation/skeletons-malecns/skeletons-swc/{{body_id}}.swc"
)

# md5Hash values from the public GCS object listing, decoded from base64.
RAW_FILES: tuple[dict[str, str], ...] = (
    {
        "name": "body-annotations-male-cns-v1.0-minconf-0.5.feather",
        "md5": "50a7718770c57220f160ba4f431ab89e",
    },
    {
        "name": "body-neurotransmitters-male-cns-v1.0.feather",
        "md5": "3d842b12fe5c49eefade528d7dd24a1f",
    },
    {
        "name": "connectome-weights-male-cns-v1.0-minconf-0.5.feather",
        "md5": "f30e9dcca25cfd021bf1e7b3d975599e",
    },
)

DATASET = "MaleCNS v1.0"
DATASET_ID = "male-cns:v1.0"
LICENSE = "CC BY 4.0"
CITATION = (
    "Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2026). "
    "Sexual dimorphism in the complete Drosophila male central nervous system connectome. "
    "Cell 189, 5504–5526.e15. https://doi.org/10.1016/j.cell.2026.08.015"
)

# Status labels that are not reconstructed neurons we want in a classroom circuit.
EXCLUDED_STATUS = frozenset(
    {"Glia", "Unimportant", "Out of scope", "Orphan-artifact", "Orphan hotknife"}
)

EXCITATORY_NT = frozenset({"acetylcholine", "ach"})
INHIBITORY_NT = frozenset({"gaba", "glutamate", "glutamic acid", "glu"})

GLB_BYTE_LIMIT = 15_000_000
NEURON_COUNT_MIN = 2_000
NEURON_COUNT_MAX = 5_000
WEIGHT_INT16_MAX = 32_767
