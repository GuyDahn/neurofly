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
