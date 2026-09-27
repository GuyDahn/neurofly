"""Regenerate baked subcircuits from the raw MaleCNS feathers.

Run from the repository:

    uv run --directory tools/data make-data
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import yaml

from wiredmind_data.annotations import load_neurons
from wiredmind_data.connectome import load_edges
from wiredmind_data.download import download_raw
from wiredmind_data.export_graph import neuron_rows, write_circuit_files
from wiredmind_data.extract_subcircuit import SeedSpec, extract_subcircuit
from wiredmind_data.gltf_bake import bake_circuit
from wiredmind_data.skeletons import fetch_skeletons, load_polylines
from wiredmind_data.sources import GLB_BYTE_LIMIT, NEURON_COUNT_MAX, NEURON_COUNT_MIN

REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = DATA_ROOT / "raw"
DIST_DIR = DATA_ROOT / "dist"
SEEDS_PATH = DATA_ROOT / "seeds.yaml"
LOCK_PATH = REPO_ROOT / "data.lock.json"

POINT_BUDGETS = (28, 16, 10, 6)


def main() -> None:
    download_raw(RAW_DIR)
    neurons = load_neurons(RAW_DIR)
    print(f"typed neurons {len(neurons)}")
    pre_idx, post_idx, weight = load_edges(RAW_DIR, neurons)
    circuits = _load_seeds(SEEDS_PATH)
    baked: list[tuple[str, list[dict[str, object]]]] = []
    for name, spec in circuits.items():
        print(f"extract {name}")
        circuit = extract_subcircuit(
            neurons,
            pre_idx,
            post_idx,
            weight,
            spec["seeds"],
            hops=spec["hops"],
            max_neurons=spec["max_neurons"],
            min_synapses=spec["min_synapses"],
        )
        count = len(circuit.neurons)
        print(f"  {count} neurons, {circuit.src.size} edges")
        if not NEURON_COUNT_MIN <= count <= NEURON_COUNT_MAX:
            raise SystemExit(
                f"{name} has {count} neurons, outside {NEURON_COUNT_MIN}–{NEURON_COUNT_MAX}. "
                "Adjust hops or max_neurons in tools/data/seeds.yaml."
            )
        _require_color_groups(name, circuit, spec["seeds"])
        graph_path, neurons_path = write_circuit_files(DIST_DIR, name, circuit, spec["seeds"])
        print(f"  wrote {graph_path.name} and {neurons_path.name}")
        rows = neuron_rows(name, circuit, spec["seeds"])
        baked.append((name, rows))
    _bake_meshes(baked)
    _write_lock(DIST_DIR, LOCK_PATH)
    print("make-data finished")


def _load_seeds(path: Path) -> dict[str, dict[str, object]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("circuits"), dict):
        raise SystemExit(f"{path} must contain a circuits mapping")
    circuits: dict[str, dict[str, object]] = {}
    for name, spec in raw["circuits"].items():
        seeds = []
        for entry in spec["seeds"]:
            seeds.append(
                SeedSpec(
                    match=str(entry["match"]),
                    value=str(entry["value"]),
                    label=str(entry["label"]),
                    color_group=str(entry["color_group"]),
                )
            )
        circuits[name] = {
            "hops": int(spec["hops"]),
            "max_neurons": int(spec["max_neurons"]),
            "min_synapses": int(spec["min_synapses"]),
            "seeds": seeds,
        }
    return circuits


def _require_color_groups(name: str, circuit, seeds: list[SeedSpec]) -> None:
    present = {seeds[index].color_group for index in circuit.group_index if index >= 0}
    expected = {seed.color_group for seed in seeds}
    missing = expected - present
    if missing:
        raise SystemExit(
            f"{name} is missing seed color groups {sorted(missing)} after the neuron cap. "
            "Raise max_neurons or drop a seed."
        )


def _bake_meshes(baked: list[tuple[str, list[dict[str, object]]]]) -> None:
    unique_ids: list[int] = []
    seen: set[int] = set()
    for _, rows in baked:
        for row in rows:
            body_id = int(row["id"])
            if body_id not in seen:
                seen.add(body_id)
                unique_ids.append(body_id)
    paths = fetch_skeletons(RAW_DIR, unique_ids)
    missing = [body_id for body_id, path in paths.items() if path is None]
    if missing and len(missing) / len(unique_ids) > 0.05:
        raise SystemExit(
            f"{len(missing)} of {len(unique_ids)} neurons have no skeleton "
            "in the MaleCNS SWC bucket."
        )
    for name, rows in baked:
        body_ids = [int(row["id"]) for row in rows]
        colors = [str(row["colorGroup"]) for row in rows]
        last_error: SystemExit | None = None
        for budget in POINT_BUDGETS:
            lines: dict[int, list[np.ndarray]] = {}
            for body_id in body_ids:
                path = paths.get(body_id)
                if path is None:
                    continue
                lines[body_id] = load_polylines(path, budget)
            try:
                bake_circuit(REPO_ROOT, DIST_DIR, name, body_ids, colors, lines)
                last_error = None
                break
            except SystemExit as exc:
                message = str(exc)
                if "over the" not in message:
                    raise
                print(
                    f"  {name} over {GLB_BYTE_LIMIT} bytes at {budget} points/neuron, simplifying"
                )
                last_error = exc
        if last_error is not None:
            raise last_error


def _write_lock(dist: Path, lock_path: Path) -> None:
    existing = json.loads(lock_path.read_text(encoding="utf-8"))
    files = []
    for path in sorted(dist.iterdir()):
        if not path.is_file() or path.name.endswith(".uncompressed.glb"):
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        files.append({"name": path.name, "sha256": digest})
    existing["files"] = files
    lock_path.write_text(json.dumps(existing, indent=2) + "\n", encoding="utf-8")
    print(f"updated {lock_path.name} with {len(files)} files")


if __name__ == "__main__":
    main()
