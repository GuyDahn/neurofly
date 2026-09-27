"""Induced subcircuits from seed cell types, a hop count, and a neuron cap."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from wiredmind_data.annotations import NeuronRecord


class SeedMatchError(RuntimeError):
    """A seed matched no neurons. The type name is wrong for this release."""


@dataclass(frozen=True)
class SeedSpec:
    match: str
    value: str
    label: str
    color_group: str


@dataclass(frozen=True)
class Subcircuit:
    neurons: list[NeuronRecord]
    """Selected neurons, sorted by body id."""

    group_index: list[int]
    """Seed index for each neuron, or -1 when it was reached only by hops."""

    src: np.ndarray
    dst: np.ndarray
    weight: np.ndarray


def matches(neuron: NeuronRecord, seed: SeedSpec) -> bool:
    if seed.match == "exact":
        return neuron.type_name == seed.value
    if seed.match == "prefix":
        return bool(neuron.type_name) and neuron.type_name.startswith(seed.value)
    if seed.match == "suffix":
        return bool(neuron.type_name) and neuron.type_name.endswith(seed.value)
    if seed.match == "class":
        return neuron.class_name == seed.value
    raise ValueError(
        f"Unknown seed match {seed.match!r}. Use exact, prefix, suffix, or class."
    )


def extract_subcircuit(
    neurons: list[NeuronRecord],
    pre_idx: np.ndarray,
    post_idx: np.ndarray,
    weight: np.ndarray,
    seeds: list[SeedSpec],
    hops: int,
    max_neurons: int,
    min_synapses: int,
) -> Subcircuit:
    """Return the induced subgraph of a hop ball, capped at ``max_neurons``.

    Seed groups are kept ahead of hop-only neurons. When the seeds themselves
    exceed the cap, neurons are taken round-robin across seed groups, strongest
    synapse total first, so one large population cannot erase a smaller one.
    """
    if hops < 0:
        raise ValueError(f"hops must be >= 0, got {hops}")
    if max_neurons < 1:
        raise ValueError(f"max_neurons must be >= 1, got {max_neurons}")
    if min_synapses < 1:
        raise ValueError(f"min_synapses must be >= 1, got {min_synapses}")
    if not seeds:
        raise ValueError("At least one seed is required")
    if max_neurons < len(seeds):
        raise ValueError(
            f"max_neurons ({max_neurons}) is smaller than the number of seeds ({len(seeds)})"
        )

    n = len(neurons)
    assigned = np.full(n, -1, dtype=np.int32)
    groups: list[np.ndarray] = []
    for seed_index, seed in enumerate(seeds):
        members = [
            index
            for index, neuron in enumerate(neurons)
            if assigned[index] < 0 and matches(neuron, seed)
        ]
        if not members:
            raise SeedMatchError(
                f"Seed {seed.value!r} ({seed.match}) matched 0 neurons. "
                "Check the type name against the MaleCNS Cell Type Explorer "
                "and tools/data/seeds.yaml."
            )
        member_arr = np.asarray(members, dtype=np.int32)
        assigned[member_arr] = seed_index
        groups.append(member_arr)

    selected = np.zeros(n, dtype=bool)
    for group in groups:
        selected[group] = True
    frontier = selected.copy()
    strong = weight >= min_synapses
    distance = np.full(n, np.int16(-1))
    distance[selected] = 0
    arrival = np.zeros(n, dtype=np.int32)
    for hop in range(1, hops + 1):
        if not frontier.any():
            break
        incident = strong & (frontier[pre_idx] | frontier[post_idx])
        if not incident.any():
            break
        reached_pre = incident & frontier[post_idx] & ~selected[pre_idx]
        reached_post = incident & frontier[pre_idx] & ~selected[post_idx]
        if reached_pre.any():
            np.maximum.at(arrival, pre_idx[reached_pre], weight[reached_pre])
        if reached_post.any():
            np.maximum.at(arrival, post_idx[reached_post], weight[reached_post])
        nbrs = np.unique(
            np.concatenate([pre_idx[reached_pre], post_idx[reached_post]])
        )
        new_frontier = np.zeros(n, dtype=bool)
        new_frontier[nbrs] = True
        distance[new_frontier] = np.int16(hop)
        selected |= new_frontier
        frontier = new_frontier

    in_ball = selected[pre_idx] & selected[post_idx] & strong
    scores = np.bincount(pre_idx[in_ball], weights=weight[in_ball], minlength=n)
    scores += np.bincount(post_idx[in_ball], weights=weight[in_ball], minlength=n)

    chosen = _cap(groups, selected, assigned, scores, arrival, distance, max_neurons)
    order = sorted(chosen, key=lambda index: neurons[index].body_id)
    remap = np.full(n, -1, dtype=np.int32)
    for new_index, old_index in enumerate(order):
        remap[old_index] = new_index

    keep = strong & (remap[pre_idx] >= 0) & (remap[post_idx] >= 0)
    src = remap[pre_idx[keep]]
    dst = remap[post_idx[keep]]
    kept_weight = weight[keep]
    edge_order = np.lexsort((dst, src, kept_weight))
    return Subcircuit(
        neurons=[neurons[index] for index in order],
        group_index=[int(assigned[index]) for index in order],
        src=src[edge_order].astype(np.uint32, copy=False),
        dst=dst[edge_order].astype(np.uint32, copy=False),
        weight=kept_weight[edge_order].astype(np.int32, copy=False),
    )


def _cap(
    groups: list[np.ndarray],
    selected: np.ndarray,
    assigned: np.ndarray,
    scores: np.ndarray,
    arrival: np.ndarray,
    distance: np.ndarray,
    max_neurons: int,
) -> list[int]:
    ranked: list[np.ndarray] = []
    for group in groups:
        inside = group[selected[group]]
        order = np.argsort(-scores[inside], kind="stable")
        ranked.append(inside[order])

    chosen: list[int] = []
    seen: set[int] = set()
    pointers = [0] * len(ranked)
    progressed = True
    while len(chosen) < max_neurons and progressed:
        progressed = False
        for group_index, members in enumerate(ranked):
            if pointers[group_index] >= len(members) or len(chosen) >= max_neurons:
                continue
            node = int(members[pointers[group_index]])
            pointers[group_index] += 1
            progressed = True
            if node not in seen:
                chosen.append(node)
                seen.add(node)

    if len(chosen) < max_neurons:
        hop_nodes = np.flatnonzero(selected & (assigned < 0))
        # Closer hops win. Within a hop, the strongest arriving synapse wins.
        hop_order = np.lexsort((-arrival[hop_nodes], distance[hop_nodes]))
        for node in hop_nodes[hop_order]:
            if len(chosen) >= max_neurons:
                break
            node = int(node)
            if node not in seen:
                chosen.append(node)
                seen.add(node)
    return chosen
