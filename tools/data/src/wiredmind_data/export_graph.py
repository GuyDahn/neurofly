"""Write graph.bin and neurons.json for one subcircuit."""

from __future__ import annotations

import json
import struct
from pathlib import Path

import numpy as np

from wiredmind_data.extract_subcircuit import SeedSpec, Subcircuit
from wiredmind_data.labels import hop_appearance
from wiredmind_data.sources import CITATION, DATASET, LICENSE, WEIGHT_INT16_MAX

MAGIC = b"NFLY"
VERSION = 1
HEADER = struct.Struct("<4sHHIIII")
EDGE = struct.Struct("<IIhbb")
HEADER_BYTES = HEADER.size  # 24
EDGE_BYTES = EDGE.size  # 12


def pack_graph(
    neuron_count: int,
    src: np.ndarray,
    dst: np.ndarray,
    weight: np.ndarray,
    nt_sign: np.ndarray,
) -> bytes:
    if not (len(src) == len(dst) == len(weight) == len(nt_sign)):
        raise ValueError("edge arrays must have the same length")
    if neuron_count < 0:
        raise ValueError("neuron_count must be >= 0")
    clamped = np.clip(weight, 0, WEIGHT_INT16_MAX).astype(np.int16)
    header = HEADER.pack(MAGIC, VERSION, 0, neuron_count, len(src), EDGE_BYTES, 0)
    records = bytearray(header)
    for pre, post, syn, sign in zip(src, dst, clamped, nt_sign, strict=True):
        records += EDGE.pack(int(pre), int(post), int(syn), int(sign), 0)
    return bytes(records)


def neuron_rows(
    circuit: str, circuit_neurons: Subcircuit, seeds: list[SeedSpec]
) -> list[dict[str, object]]:
    is_input = _inputs_to_seeds(circuit_neurons)
    rows: list[dict[str, object]] = []
    for index, neuron in enumerate(circuit_neurons.neurons):
        group = circuit_neurons.group_index[index]
        if group >= 0:
            label = seeds[group].label
            color_group = seeds[group].color_group
        else:
            label, color_group = hop_appearance(circuit, neuron, is_input[index])
        rows.append(
            {
                "id": neuron.body_id,
                "type": neuron.type_name,
                "superclass": neuron.superclass,
                "label": label,
                "colorGroup": color_group,
                "neurotransmitter": neuron.neurotransmitter,
                "ntSign": neuron.nt_sign,
            }
        )
    return rows


def write_circuit_files(
    dist: Path,
    circuit: str,
    circuit_neurons: Subcircuit,
    seeds: list[SeedSpec],
) -> tuple[Path, Path]:
    dist.mkdir(parents=True, exist_ok=True)
    rows = neuron_rows(circuit, circuit_neurons, seeds)
    signs = np.array([neuron.nt_sign for neuron in circuit_neurons.neurons], dtype=np.int8)
    edge_signs = signs[circuit_neurons.src]
    graph_path = dist / f"{circuit}.graph.bin"
    neurons_path = dist / f"{circuit}.neurons.json"
    graph_path.write_bytes(
        pack_graph(
            len(circuit_neurons.neurons),
            circuit_neurons.src,
            circuit_neurons.dst,
            circuit_neurons.weight,
            edge_signs,
        )
    )
    payload = {
        "circuit": circuit,
        "dataset": DATASET,
        "license": LICENSE,
        "citation": CITATION,
        "neurons": rows,
    }
    neurons_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return graph_path, neurons_path


def _inputs_to_seeds(circuit_neurons: Subcircuit) -> np.ndarray:
    n = len(circuit_neurons.neurons)
    is_input = np.zeros(n, dtype=bool)
    groups = np.asarray(circuit_neurons.group_index)
    seed = groups >= 0
    if circuit_neurons.src.size == 0:
        return is_input
    src_is_hop = ~seed[circuit_neurons.src]
    dst_is_seed = seed[circuit_neurons.dst]
    is_input[circuit_neurons.src[src_is_hop & dst_is_seed]] = True
    return is_input
