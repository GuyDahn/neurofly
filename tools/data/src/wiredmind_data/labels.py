"""Plain-English labels for neurons that were not themselves seeds."""

from __future__ import annotations

from wiredmind_data.annotations import NeuronRecord


def hop_appearance(
    circuit: str, neuron: NeuronRecord, is_input: bool
) -> tuple[str, str]:
    """Return ``(label, color_group)`` for a neuron reached only by hops."""
    if circuit == "escape":
        if is_input:
            return "Giant fiber input", "input"
        if neuron.superclass == "descending_neuron" or neuron.type_name.startswith("DN"):
            return "Descending target", "descending"
        return "Giant fiber target", "target"
    if circuit == "visual":
        visual = neuron.superclass in {"visual_projection", "visual_centrifugal"}
        if visual or neuron.class_name == "visual":
            return "Visual projection neuron", "visual-input"
        if neuron.class_name == "CX":
            return "Central complex neuron", "compass"
        return "Connected partner", "other"
    if neuron.class_name == "DAN":
        return "Dopaminergic neuron", "other"
    if neuron.class_name == "ALLN":
        return "Antennal lobe local neuron", "other"
    return "Connected partner", "other"
