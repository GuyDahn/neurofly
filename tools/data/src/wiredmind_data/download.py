"""Download flat-connectome files and check them against the bucket MD5."""

from __future__ import annotations

import hashlib
import urllib.request
from pathlib import Path

from wiredmind_data.sources import FLAT_PREFIX, RAW_FILES


def md5_file(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_md5(path: Path, expected: str) -> None:
    actual = md5_file(path)
    if actual != expected:
        raise SystemExit(
            f"MD5 mismatch for {path.name}: expected {expected}, got {actual}. "
            "The download is incomplete or not the MaleCNS v1.0 object."
        )


def download_raw(raw_dir: Path) -> None:
    raw_dir.mkdir(parents=True, exist_ok=True)
    for spec in RAW_FILES:
        dest = raw_dir / spec["name"]
        expected = spec["md5"]
        if dest.exists() and dest.stat().st_size > 0:
            actual = md5_file(dest)
            if actual == expected:
                print(f"md5 ok  {dest.name}")
                continue
            print(f"md5 mismatch, re-downloading {dest.name}")
            dest.unlink()
        url = f"{FLAT_PREFIX}/{spec['name']}"
        partial = dest.with_suffix(dest.suffix + ".partial")
        print(f"download {url}")
        urllib.request.urlretrieve(url, partial)
        verify_md5(partial, expected)
        partial.replace(dest)
        print(f"md5 ok  {dest.name}")
