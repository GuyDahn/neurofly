export type NeuronRow = {
  id: number;
  colorGroup: string;
};

export function indicesByColorGroup(
  neurons: readonly { colorGroup: string }[],
): Map<string, Uint32Array> {
  const lists = new Map<string, number[]>();
  for (let index = 0; index < neurons.length; index++) {
    const group = neurons[index]?.colorGroup;
    if (!group) continue;
    const list = lists.get(group);
    if (list) list.push(index);
    else lists.set(group, [index]);
  }
  const out = new Map<string, Uint32Array>();
  for (const [group, list] of lists) out.set(group, Uint32Array.from(list));
  return out;
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
