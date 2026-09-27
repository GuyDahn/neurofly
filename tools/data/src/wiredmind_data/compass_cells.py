"""List the compass cells the heading lesson drives, from MaleCNS instance names.

Run from the repository after make-data:

    uv run --directory tools/data compass-cells

The baked neurons.json keeps cell types but not sides, so the lesson file
names the body ids it needs. This prints them as JSON:

- P-EN2 turn neurons (type PEN_b(PEN2)), split by protocerebral bridge side
- E-PG compass neurons (type EPG) in the 16 ellipsoid body wedges, each with
  its angle measured from the SWC skeletons as seen from behind the fly
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

from wiredmind_data.skeletons import parse_swc
from wiredmind_data.sources import RAW_FILES

DATA_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = DATA_ROOT / "raw"
DIST_DIR = DATA_ROOT / "dist"

# Ellipsoid body wedges in ring order. Neighboring E-PGs alternate between the
# right and left bridge (Wolff et al. 2015, Hulse et al. 2021).
WEDGE_ORDER = (
    "R1", "L8", "R2", "L7", "R3", "L6", "R4", "L5",
    "R5", "L4", "R6", "L3", "R7", "L2", "R8", "L1",
)  # fmt: skip

# SWC voxels are 8 nm. The ring neuron arbor sits within 48 um of its center.
EB_RADIUS = 6000
EPG_EB_RADIUS = 5500


def glomerulus(instance: str) -> str | None:
    """Bridge glomerulus from an instance such as ``EPG(PB08)_R2``."""
    found = re.search(r"\(PB\d+[a-z]?\)_([LR]\d)$", instance)
    return found.group(1) if found else None


def circular_mean(degrees: list[float]) -> float:
    x = sum(math.cos(math.radians(value)) for value in degrees)
    y = sum(math.sin(math.radians(value)) for value in degrees)
    return math.degrees(math.atan2(y, x)) % 360


def back_view_angle(offset: np.ndarray) -> float:
    """Degrees clockwise from dorsal, seen from behind the fly.

    MaleCNS x grows toward the fly's left and y grows ventrally, so from behind
    the fly's left is on the viewer's left and dorsal is up.
    """
    return math.degrees(math.atan2(-float(offset[0]), -float(offset[1]))) % 360


def check_ring(angles: list[float]) -> None:
    """Consecutive wedges must step the same way around the ring."""
    steps = []
    for index, angle in enumerate(angles):
        step = (angles[(index + 1) % len(angles)] - angle + 540) % 360 - 180
        steps.append(step)
    if not (all(5 < step < 45 for step in steps) or all(-45 < step < -5 for step in steps)):
        raise SystemExit(f"Wedge angles do not go around the ring in order: {angles}")


def _skeleton(body_id: int) -> np.ndarray:
    path = RAW_DIR / "skeletons" / f"{body_id}.swc"
    if not path.exists():
        raise SystemExit(f"Missing skeleton {path}. Run make-data first.")
    xyz, _, _ = parse_swc(path.read_text(encoding="utf-8", errors="replace"))
    return xyz.astype(np.float64)


def _eb_center(ring_ids: list[int]) -> np.ndarray:
    nodes = np.concatenate([_skeleton(body_id) for body_id in ring_ids])
    midline = float(nodes[:, 0].mean())
    near = nodes[np.abs(nodes[:, 0] - midline) < EB_RADIUS * 2 / 3]
    center = near.mean(axis=0)
    for _ in range(4):
        inside = near[np.linalg.norm(near - center, axis=1) < EB_RADIUS]
        center = inside.mean(axis=0)
    return center


def main() -> None:
    circuit = json.loads((DIST_DIR / "visual.neurons.json").read_text(encoding="utf-8"))
    rows = circuit["neurons"]
    in_circuit = {int(row["id"]) for row in rows}
    ann = feather.read_table(
        RAW_DIR / RAW_FILES[0]["name"], columns=["bodyId", "type", "instance"]
    ).to_pylist()
    instance = {int(row["bodyId"]): (row["type"] or "", row["instance"] or "") for row in ann}

    turn: dict[str, list[int]] = {"L": [], "R": []}
    wedges: dict[str, list[int]] = {name: [] for name in WEDGE_ORDER}
    for body_id in sorted(in_circuit):
        type_name, name = instance.get(body_id, ("", ""))
        found = glomerulus(name)
        if found is None:
            continue
        if type_name == "PEN_b(PEN2)":
            turn[found[0]].append(body_id)
        elif type_name == "EPG" and found in wedges:
            wedges[found].append(body_id)
    if not turn["L"] or not turn["R"]:
        raise SystemExit("The visual circuit has no P-EN2 neurons on one side.")
    empty = [name for name, ids in wedges.items() if not ids]
    if empty:
        raise SystemExit(f"No E-PG neurons in wedges {empty}.")

    ring_ids = [int(row["id"]) for row in rows if row["colorGroup"] == "ring"]
    center = _eb_center(ring_ids)
    out = []
    for name in WEDGE_ORDER:
        angles = []
        for body_id in wedges[name]:
            nodes = _skeleton(body_id)
            inside = nodes[np.linalg.norm(nodes - center, axis=1) < EPG_EB_RADIUS]
            if len(inside) < 5:
                raise SystemExit(f"E-PG {body_id} has no arbor in the ellipsoid body.")
            angles.append(back_view_angle(inside.mean(axis=0) - center))
        out.append({"glomerulus": name, "angle": round(circular_mean(angles)), "ids": wedges[name]})
    check_ring([float(wedge["angle"]) for wedge in out])
    print(json.dumps({"turn-left": turn["L"], "turn-right": turn["R"], "wedges": out}))


if __name__ == "__main__":
    main()
