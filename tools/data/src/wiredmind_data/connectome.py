"""Stream the flat weights table into edges between annotated neurons."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.feather as feather
import pyarrow.ipc as ipc

from wiredmind_data.annotations import NeuronRecord
from wiredmind_data.sources import RAW_FILES

PRE_NAMES = ("bodyId_pre", "body_pre", "pre", "bodyid_pre")
POST_NAMES = ("bodyId_post", "body_post", "post", "bodyid_post")
WEIGHT_NAMES = ("weight", "synapses", "count", "N")
CACHE_NAME = "annotated-edges.npz"


def _pick(names: tuple[str, ...], available: set[str]) -> str:
    for name in names:
        if name in available:
            return name
    raise SystemExit(
        "Weights table is missing an expected column. "
        f"Wanted one of {names}, found {sorted(available)}"
    )


def _edge_columns(path: Path) -> tuple[str, str, str]:
    with pa.memory_map(str(path), "r") as source:
        schema = ipc.open_file(source).schema
    available = set(schema.names)
    return _pick(PRE_NAMES, available), _pick(POST_NAMES, available), _pick(WEIGHT_NAMES, available)


def load_edges(
    raw_dir: Path, neurons: list[NeuronRecord]
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return pre_idx, post_idx, weight as indices into ``neurons``."""
    weights_path = raw_dir / RAW_FILES[2]["name"]
    cache_path = raw_dir / CACHE_NAME
    body_ids = np.array([neuron.body_id for neuron in neurons], dtype=np.int64)
    stamp = f"{weights_path.stat().st_size}:{body_ids.size}"
    if cache_path.exists():
        cached = np.load(cache_path)
        if str(cached["stamp"]) == stamp:
            print(f"edges cache {cache_path.name} ({cached['pre'].size} edges)")
            return cached["pre"], cached["post"], cached["weight"]

    pre_name, post_name, weight_name = _edge_columns(weights_path)
    print(f"reading {weights_path.name} columns {pre_name}, {post_name}, {weight_name}")
    # Schema read above already pulled the file into the Arrow default pool.
    # Re-open with only the three columns we keep.
    table = feather.read_table(weights_path, columns=[pre_name, post_name, weight_name])
    pre = table.column(pre_name).to_numpy().astype(np.int64, copy=False)
    post = table.column(post_name).to_numpy().astype(np.int64, copy=False)
    weight = table.column(weight_name).to_numpy().astype(np.int32, copy=False)
    del table

    pre_idx = _map_ids(body_ids, pre)
    post_idx = _map_ids(body_ids, post)
    keep = (pre_idx >= 0) & (post_idx >= 0) & (weight > 0)
    pre_idx = pre_idx[keep].astype(np.int32, copy=False)
    post_idx = post_idx[keep].astype(np.int32, copy=False)
    weight = weight[keep]
    print(f"kept {pre_idx.size} edges between typed neurons")
    np.savez_compressed(
        cache_path,
        pre=pre_idx,
        post=post_idx,
        weight=weight,
        stamp=np.array(stamp),
    )
    return pre_idx, post_idx, weight


def _map_ids(sorted_body_ids: np.ndarray, values: np.ndarray) -> np.ndarray:
    pos = np.searchsorted(sorted_body_ids, values)
    safe = np.minimum(pos, len(sorted_body_ids) - 1)
    matched = (pos < len(sorted_body_ids)) & (sorted_body_ids[safe] == values)
    mapped = np.full(values.shape, -1, dtype=np.int32)
    mapped[matched] = safe[matched].astype(np.int32, copy=False)
    return mapped
