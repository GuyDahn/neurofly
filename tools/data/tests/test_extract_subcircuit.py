import numpy as np
import pytest

from wiredmind_data.annotations import NeuronRecord
from wiredmind_data.export_graph import HEADER, MAGIC, VERSION, pack_graph
from wiredmind_data.extract_subcircuit import SeedMatchError, SeedSpec, extract_subcircuit


def _neuron(body_id: int, type_name: str, class_name: str = "") -> NeuronRecord:
    return NeuronRecord(body_id, type_name, class_name, "cb_intrinsic", "acetylcholine", 1)


def test_seed_that_matches_nothing_fails() -> None:
    neurons = [_neuron(1, "EPG")]
    with pytest.raises(SeedMatchError, match="NOPE"):
        extract_subcircuit(
            neurons,
            np.array([], dtype=np.int32),
            np.array([], dtype=np.int32),
            np.array([], dtype=np.int32),
            [SeedSpec("exact", "NOPE", "Missing", "other")],
            hops=0,
            max_neurons=10,
            min_synapses=1,
        )


def test_hops_and_strongest_neighbor() -> None:
    neurons = [_neuron(10, "GF"), _neuron(11, "A"), _neuron(12, "B"), _neuron(13, "C")]
    # GF-A weight 50, GF-B weight 2, A-C weight 40. min_synapses drops B.
    pre = np.array([0, 0, 1], dtype=np.int32)
    post = np.array([1, 2, 3], dtype=np.int32)
    weight = np.array([50, 2, 40], dtype=np.int32)
    circuit = extract_subcircuit(
        neurons,
        pre,
        post,
        weight,
        [SeedSpec("exact", "GF", "Giant fiber", "giant-fiber")],
        hops=2,
        max_neurons=3,
        min_synapses=5,
    )
    assert [neuron.body_id for neuron in circuit.neurons] == [10, 11, 13]
    assert circuit.group_index[0] == 0
    assert set(circuit.group_index[1:]) == {-1}
    assert circuit.src.size == 2


def test_closer_hops_beat_a_heavy_downstream_hub() -> None:
    neurons = [
        _neuron(1, "GF"),
        _neuron(2, "input"),
        _neuron(3, "hub"),
        _neuron(4, "far"),
    ]
    pre = np.array([0, 0, 2], dtype=np.int32)
    post = np.array([1, 2, 3], dtype=np.int32)
    weight = np.array([10, 100, 5000], dtype=np.int32)
    circuit = extract_subcircuit(
        neurons,
        pre,
        post,
        weight,
        [SeedSpec("exact", "GF", "Giant fiber", "giant-fiber")],
        hops=2,
        max_neurons=3,
        min_synapses=1,
    )
    assert [neuron.body_id for neuron in circuit.neurons] == [1, 2, 3]


def test_round_robin_keeps_a_small_seed_group() -> None:
    neurons = [_neuron(i, "ORN_DM1") for i in range(5)] + [_neuron(100, "MBON01")]
    circuit = extract_subcircuit(
        neurons,
        np.array([], dtype=np.int32),
        np.array([], dtype=np.int32),
        np.array([], dtype=np.int32),
        [
            SeedSpec("prefix", "ORN_", "Olfactory receptor neuron", "orn"),
            SeedSpec("prefix", "MBON", "Mushroom body output neuron", "mbon"),
        ],
        hops=0,
        max_neurons=3,
        min_synapses=1,
    )
    groups = {neuron.type_name for neuron in circuit.neurons}
    assert "MBON01" in groups
    assert len(circuit.neurons) == 3


def test_graph_bin_header_and_edge() -> None:
    blob = pack_graph(
        2,
        np.array([0], dtype=np.uint32),
        np.array([1], dtype=np.uint32),
        np.array([40000], dtype=np.int32),
        np.array([-1], dtype=np.int8),
    )
    magic, version, _flags, neurons, edges, record, _reserved = HEADER.unpack_from(blob)
    assert magic == MAGIC
    assert version == VERSION
    assert neurons == 2
    assert edges == 1
    assert record == 12
    assert blob[24:28] == (0).to_bytes(4, "little")
    assert blob[28:32] == (1).to_bytes(4, "little")
    weight = int.from_bytes(blob[32:34], "little", signed=True)
    assert weight == 32767
    assert int.from_bytes(blob[34:35], "little", signed=True) == -1
