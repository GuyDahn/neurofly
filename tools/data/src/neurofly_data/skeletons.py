"""Download MaleCNS SWC skeletons and turn them into short polylines."""

from __future__ import annotations

import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from neurofly_data.sources import SKELETON_URL


def skeleton_path(raw_dir: Path, body_id: int) -> Path:
    return raw_dir / "skeletons" / f"{body_id}.swc"


def fetch_skeletons(
    raw_dir: Path, body_ids: list[int], workers: int = 32
) -> dict[int, Path | None]:
    dest_dir = raw_dir / "skeletons"
    dest_dir.mkdir(parents=True, exist_ok=True)
    pending = [body_id for body_id in body_ids if not skeleton_path(raw_dir, body_id).exists()]
    print(f"skeletons {len(body_ids) - len(pending)} cached, {len(pending)} to download")

    def fetch_one(body_id: int) -> tuple[int, str | None]:
        dest = skeleton_path(raw_dir, body_id)
        url = SKELETON_URL.format(body_id=body_id)
        try:
            urllib.request.urlretrieve(url, dest)
        except urllib.error.HTTPError as exc:
            if dest.exists():
                dest.unlink()
            return body_id, f"HTTP {exc.code}"
        except urllib.error.URLError as exc:
            if dest.exists():
                dest.unlink()
            return body_id, str(exc.reason)
        return body_id, None

    failures: dict[int, str] = {}
    if pending:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(fetch_one, body_id) for body_id in pending]
            done = 0
            for future in as_completed(futures):
                body_id, error = future.result()
                done += 1
                if error:
                    failures[body_id] = error
                if done % 500 == 0 or done == len(pending):
                    print(f"  downloaded {done}/{len(pending)}")
    found: dict[int, Path | None] = {}
    for body_id in body_ids:
        path = skeleton_path(raw_dir, body_id)
        found[body_id] = path if path.exists() else None
    missing = len(body_ids) - sum(path is not None for path in found.values())
    if missing:
        print(f"warning: {missing} neurons have no SWC ({len(failures)} new failures)")
    return found


def parse_swc(text: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    ids: list[int] = []
    coords: list[tuple[float, float, float]] = []
    parents: list[int] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 7:
            continue
        ids.append(int(float(parts[0])))
        coords.append((float(parts[2]), float(parts[3]), float(parts[4])))
        parents.append(int(float(parts[6])))
    if not ids:
        empty = np.zeros(0, dtype=np.int32)
        return np.zeros((0, 3), dtype=np.float32), empty, empty
    return (
        np.asarray(coords, dtype=np.float32),
        np.asarray(ids, dtype=np.int32),
        np.asarray(parents, dtype=np.int32),
    )


def polylines(
    xyz: np.ndarray, sample_ids: np.ndarray, parents: np.ndarray, max_points: int
) -> list[np.ndarray]:
    """Resample each branch of an SWC into at most ``max_points`` vertices total."""
    count = len(xyz)
    if count < 2:
        return []
    index_of = {int(sample_id): index for index, sample_id in enumerate(sample_ids.tolist())}
    children: list[list[int]] = [[] for _ in range(count)]
    roots: list[int] = []
    for index, parent in enumerate(parents.tolist()):
        parent_index = index_of.get(int(parent))
        if parent_index is None or parent_index == index:
            roots.append(index)
            continue
        children[parent_index].append(index)
    if not roots:
        roots = [0]

    chains: list[list[int]] = []

    def walk(start: int, first_child: int) -> None:
        chain = [start, first_child]
        node = first_child
        while len(children[node]) == 1:
            node = children[node][0]
            chain.append(node)
        chains.append(chain)
        if len(children[node]) > 1:
            for child in children[node]:
                walk(node, child)

    for root in roots:
        if not children[root]:
            continue
        for child in children[root]:
            walk(root, child)
    if not chains:
        return []

    if len(chains) * 2 > max_points:
        chains = sorted(chains, key=len, reverse=True)[: max(1, max_points // 2)]
    lengths = [max(len(chain) - 1, 1) for chain in chains]
    total = sum(lengths)
    budget = max_points
    lines: list[np.ndarray] = []
    for chain, length in zip(chains, lengths, strict=True):
        share = max(2, int(round(budget * length / total)))
        lines.append(_resample(xyz[np.asarray(chain, dtype=np.int32)], share))
    return lines


def _resample(points: np.ndarray, count: int) -> np.ndarray:
    if len(points) <= count:
        return points
    step = np.linalg.norm(np.diff(points, axis=0), axis=1)
    if float(step.sum()) == 0:
        return points[:count]
    cumulative = np.concatenate([[0.0], np.cumsum(step)])
    targets = np.linspace(0.0, float(cumulative[-1]), count)
    out = np.empty((count, 3), dtype=np.float32)
    for index, target in enumerate(targets):
        span = int(np.searchsorted(cumulative, target, side="right") - 1)
        span = min(max(span, 0), len(points) - 2)
        width = float(cumulative[span + 1] - cumulative[span])
        blend = 0.0 if width == 0 else (float(target) - float(cumulative[span])) / width
        out[index] = points[span] * (1.0 - blend) + points[span + 1] * blend
    return out


def load_polylines(path: Path, max_points: int) -> list[np.ndarray]:
    xyz, sample_ids, parents = parse_swc(path.read_text(encoding="utf-8", errors="replace"))
    # SWC coordinates are 8 nm voxels. Store microns.
    return polylines(xyz * np.float32(0.008), sample_ids, parents, max_points)
