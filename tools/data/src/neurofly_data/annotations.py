"""Load MaleCNS body annotations and consensus neurotransmitters."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

from neurofly_data.sources import EXCITATORY_NT, EXCLUDED_STATUS, INHIBITORY_NT, RAW_FILES


@dataclass(frozen=True)
class NeuronRecord:
    body_id: int
    type_name: str
    class_name: str
    superclass: str
    neurotransmitter: str
    nt_sign: int


def nt_sign(name: str) -> int:
    key = name.strip().lower()
    if key in EXCITATORY_NT:
        return 1
    if key in INHIBITORY_NT:
        return -1
    return 0


def _text(value: object) -> str:
    if value is None:
        return ""
    return str(value)


def _column(table, name: str):
    if name not in table.column_names:
        raise SystemExit(f"Annotation table is missing column {name!r}. Found {table.column_names}")
    return table.column(name)


def load_neurons(raw_dir: Path) -> list[NeuronRecord]:
    ann_name = RAW_FILES[0]["name"]
    nt_name = RAW_FILES[1]["name"]
    ann = feather.read_table(
        raw_dir / ann_name,
        columns=["bodyId", "type", "superclass", "class", "statusLabel"],
    )
    nt = feather.read_table(raw_dir / nt_name, columns=["body", "consensus_nt", "predicted_nt"])

    body_ids = _column(ann, "bodyId").to_numpy()
    types = [_text(v) for v in _column(ann, "type").to_pylist()]
    superclasses = [_text(v) for v in _column(ann, "superclass").to_pylist()]
    classes = [_text(v) for v in _column(ann, "class").to_pylist()]
    status = [_text(v) for v in _column(ann, "statusLabel").to_pylist()]

    nt_body = _column(nt, "body").to_numpy()
    consensus = [_text(v) for v in _column(nt, "consensus_nt").to_pylist()]
    predicted = [_text(v) for v in _column(nt, "predicted_nt").to_pylist()]
    order = np.argsort(nt_body, kind="stable")
    nt_body = nt_body[order]
    consensus_arr = np.array(consensus, dtype=object)[order]
    predicted_arr = np.array(predicted, dtype=object)[order]
    found = np.searchsorted(nt_body, body_ids)
    in_range = found < len(nt_body)
    safe = np.minimum(found, len(nt_body) - 1)
    matched = in_range & (nt_body[safe] == body_ids)

    neurons: list[NeuronRecord] = []
    for i, body_id in enumerate(body_ids.tolist()):
        if not types[i] or status[i] in EXCLUDED_STATUS:
            continue
        chemical = ""
        if matched[i]:
            chemical = _text(consensus_arr[safe[i]]) or _text(predicted_arr[safe[i]])
        neurons.append(
            NeuronRecord(
                body_id=int(body_id),
                type_name=types[i],
                class_name=classes[i],
                superclass=superclasses[i],
                neurotransmitter=chemical,
                nt_sign=nt_sign(chemical),
            )
        )
    neurons.sort(key=lambda neuron: neuron.body_id)
    if not neurons:
        raise SystemExit("No typed neurons left after filtering annotations.")
    return neurons
