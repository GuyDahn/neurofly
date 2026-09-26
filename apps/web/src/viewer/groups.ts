import type { GroupSpec } from "./types.js";

export type NeuronRow = {
  id: number;
  type: string;
  colorGroup: string;
};

export type Assignment = {
  /** Neuron indices for each module group, in file order. */
  groups: Map<string, Uint32Array>;
  /** Module group index for each neuron, or -1 for context cells. */
  member: Int16Array;
};

/**
 * Puts each neuron in the first module group that claims it, by baked color
 * group, cell type, or body id. Neurons no group claims stay as context.
 */
export function assignGroups(
  neurons: readonly NeuronRow[],
  groups: readonly GroupSpec[],
): Assignment {
  const rules = groups.map((group) => ({
    colorGroups: new Set(group.match.colorGroups),
    types: new Set(group.match.types),
    ids: new Set(group.match.ids),
  }));
  const member = new Int16Array(neurons.length).fill(-1);
  const lists: number[][] = groups.map(() => []);
  for (let index = 0; index < neurons.length; index++) {
    const neuron = neurons[index];
    if (!neuron) continue;
    const at = rules.findIndex(
      (rule) =>
        rule.ids.has(neuron.id) ||
        rule.types.has(neuron.type) ||
        rule.colorGroups.has(neuron.colorGroup),
    );
    if (at < 0) continue;
    member[index] = at;
    lists[at]?.push(index);
  }
  const out = new Map<string, Uint32Array>();
  groups.forEach((group, at) => {
    out.set(group.colorGroup, Uint32Array.from(lists[at] ?? []));
  });
  return { groups: out, member };
}

export function bodyIndex(
  neurons: readonly { id: number }[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (let index = 0; index < neurons.length; index++) {
    const id = neurons[index]?.id;
    if (typeof id === "number") map.set(id, index);
  }
  return map;
}

/** Marks the neurons in `focus` at 255 and the rest at 0. An empty focus lights every neuron. */
export function writeFocus(
  bytes: Uint8Array,
  groups: ReadonlyMap<string, Uint32Array>,
  focus: readonly string[],
) {
  if (focus.length === 0) {
    bytes.fill(255);
    return;
  }
  bytes.fill(0);
  for (const name of focus) {
    const ids = groups.get(name);
    if (!ids) continue;
    for (let index = 0; index < ids.length; index++) {
      bytes[ids[index] ?? 0] = 255;
    }
  }
}
