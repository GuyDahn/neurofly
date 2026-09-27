"""Bake simplified skeleton tubes into one Draco glTF per subcircuit."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
from pygltflib import (
    ARRAY_BUFFER,
    ELEMENT_ARRAY_BUFFER,
    FLOAT,
    GLTF2,
    TRIANGLES,
    UNSIGNED_INT,
    Accessor,
    Asset,
    Attributes,
    Buffer,
    BufferView,
    Material,
    Mesh,
    Node,
    PbrMetallicRoughness,
    Primitive,
    Scene,
)

from wiredmind_data.sources import DATASET, GLB_BYTE_LIMIT, LICENSE

COLORS: dict[str, list[float]] = {
    "orn": [0.93, 0.55, 0.16, 1.0],
    "pn": [0.93, 0.78, 0.22, 1.0],
    "kc": [0.25, 0.62, 0.93, 1.0],
    "mbon": [0.86, 0.28, 0.46, 1.0],
    "ring": [0.42, 0.78, 0.48, 1.0],
    "compass": [0.32, 0.42, 0.90, 1.0],
    "visual-input": [0.25, 0.72, 0.70, 1.0],
    "giant-fiber": [0.90, 0.18, 0.18, 1.0],
    "input": [0.95, 0.58, 0.22, 1.0],
    "target": [0.62, 0.32, 0.78, 1.0],
    "descending": [0.55, 0.36, 0.72, 1.0],
    "other": [0.62, 0.64, 0.68, 1.0],
}


def tube(
    polyline: np.ndarray, radius: float = 0.35, sides: int = 3
) -> tuple[np.ndarray, np.ndarray]:
    if len(polyline) < 2:
        return np.zeros((0, 3), dtype=np.float32), np.zeros((0, 3), dtype=np.uint32)
    tangents = np.diff(polyline, axis=0)
    tangents = np.vstack([tangents, tangents[-1]])
    lengths = np.linalg.norm(tangents, axis=1, keepdims=True)
    lengths[lengths == 0] = 1
    tangents = tangents / lengths
    rings: list[np.ndarray] = []
    for point, tangent in zip(polyline, tangents, strict=True):
        if abs(float(tangent[2])) < 0.9:
            up = np.array([0.0, 0.0, 1.0])
        else:
            up = np.array([0.0, 1.0, 0.0])
        side = np.cross(tangent, up)
        side_norm = float(np.linalg.norm(side))
        if side_norm == 0:
            side = np.array([1.0, 0.0, 0.0])
        else:
            side = side / side_norm
        lifted = np.cross(side, tangent)
        angles = np.linspace(0, 2 * np.pi, sides, endpoint=False)
        rings.append(
            point
            + radius * np.outer(np.cos(angles), side)
            + radius * np.outer(np.sin(angles), lifted)
        )
    stacked = np.vstack(rings).astype(np.float32)
    faces: list[tuple[int, int, int]] = []
    for ring in range(len(rings) - 1):
        for side_index in range(sides):
            a = ring * sides + side_index
            b = ring * sides + (side_index + 1) % sides
            c = a + sides
            d = b + sides
            faces.append((a, c, b))
            faces.append((b, c, d))
    return stacked, np.asarray(faces, dtype=np.uint32)


def write_glb(
    path: Path,
    circuit: str,
    body_ids: list[int],
    color_groups: list[str],
    lines_by_id: dict[int, list[np.ndarray]],
) -> None:
    blob = bytearray()
    accessors: list[Accessor] = []
    views: list[BufferView] = []
    meshes: list[Mesh] = []
    nodes: list[Node] = []
    materials: list[Material] = []
    material_of: dict[str, int] = {}

    def material(color_group: str) -> int:
        if color_group not in material_of:
            material_of[color_group] = len(materials)
            materials.append(
                Material(
                    name=color_group,
                    pbrMetallicRoughness=PbrMetallicRoughness(
                        baseColorFactor=COLORS.get(color_group, COLORS["other"]),
                        metallicFactor=0.0,
                        roughnessFactor=0.85,
                    ),
                )
            )
        return material_of[color_group]

    def pad4() -> None:
        while len(blob) % 4:
            blob.append(0)

    for body_id, color_group in zip(body_ids, color_groups, strict=True):
        parts = lines_by_id.get(body_id) or []
        vertices: list[np.ndarray] = []
        faces: list[np.ndarray] = []
        offset = 0
        for line in parts:
            verts, tris = tube(line)
            if len(verts) == 0:
                continue
            vertices.append(verts)
            faces.append(tris + offset)
            offset += len(verts)
        if not vertices:
            continue
        point_array = np.vstack(vertices).astype(np.float32)
        face_array = np.vstack(faces).astype(np.uint32)
        pad4()
        point_start = len(blob)
        blob += point_array.tobytes()
        pad4()
        face_start = len(blob)
        blob += face_array.reshape(-1).tobytes()
        point_view = len(views)
        views.append(
            BufferView(
                buffer=0,
                byteOffset=point_start,
                byteLength=point_array.nbytes,
                target=ARRAY_BUFFER,
            )
        )
        face_view = len(views)
        views.append(
            BufferView(
                buffer=0,
                byteOffset=face_start,
                byteLength=face_array.nbytes,
                target=ELEMENT_ARRAY_BUFFER,
            )
        )
        point_accessor = len(accessors)
        minimum = point_array.min(axis=0).tolist()
        maximum = point_array.max(axis=0).tolist()
        accessors.append(
            Accessor(
                bufferView=point_view,
                componentType=FLOAT,
                count=len(point_array),
                type="VEC3",
                min=minimum,
                max=maximum,
            )
        )
        face_accessor = len(accessors)
        accessors.append(
            Accessor(
                bufferView=face_view,
                componentType=UNSIGNED_INT,
                count=int(face_array.size),
                type="SCALAR",
            )
        )
        mesh_index = len(meshes)
        meshes.append(
            Mesh(
                primitives=[
                    Primitive(
                        attributes=Attributes(POSITION=point_accessor),
                        indices=face_accessor,
                        material=material(color_group),
                        mode=TRIANGLES,
                    )
                ]
            )
        )
        nodes.append(Node(mesh=mesh_index, name=str(body_id), extras={"bodyId": int(body_id)}))

    if not nodes:
        raise SystemExit(f"{circuit}: no skeleton geometry to bake")

    pad4()
    gltf = GLTF2(
        asset=Asset(
            version="2.0",
            generator="wiredmind make-data",
            extras={
                "dataset": DATASET,
                "license": LICENSE,
                "circuit": circuit,
                "units": "micrometers",
            },
        ),
        scenes=[Scene(nodes=list(range(len(nodes))))],
        scene=0,
        nodes=nodes,
        meshes=meshes,
        materials=materials,
        accessors=accessors,
        bufferViews=views,
        buffers=[Buffer(byteLength=len(blob))],
    )
    gltf.set_binary_blob(bytes(blob))
    path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save(path)


def compress_draco(source: Path, dest: Path, repo_root: Path) -> None:
    binary = shutil.which("pnpm")
    if binary is None:
        raise SystemExit(
            "pnpm is required to Draco-compress glTF (devDependency @gltf-transform/cli)."
        )
    subprocess.run(
        [
            binary,
            "exec",
            "gltf-transform",
            "draco",
            str(source),
            str(dest),
            "--method",
            "edgebreaker",
            "--quantize-position",
            "14",
        ],
        cwd=repo_root,
        check=True,
    )


def bake_circuit(
    repo_root: Path,
    dist: Path,
    circuit: str,
    body_ids: list[int],
    color_groups: list[str],
    lines_by_id: dict[int, list[np.ndarray]],
) -> Path:
    plain = dist / f"{circuit}.uncompressed.glb"
    final = dist / f"{circuit}.glb"
    write_glb(plain, circuit, body_ids, color_groups, lines_by_id)
    compress_draco(plain, final, repo_root)
    plain.unlink(missing_ok=True)
    size = final.stat().st_size
    if size >= GLB_BYTE_LIMIT:
        raise SystemExit(
            f"{final.name} is {size} bytes, over the {GLB_BYTE_LIMIT} byte limit. "
            "Simplify skeletons further and re-run."
        )
    print(f"wrote {final.name} ({size} bytes)")
    return final
