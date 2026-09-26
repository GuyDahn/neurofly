/** Wall-clock pulse. A spike starts at full brightness and reaches 0 in this many ms. */
export const FLASH_DECAY_MS = 150;

export class FlashField {
  readonly values: Float32Array;
  readonly bytes: Uint8Array;
  private readonly hot: Uint8Array;
  private active: number[] = [];

  constructor(count: number) {
    this.values = new Float32Array(count);
    this.bytes = new Uint8Array(count);
    this.hot = new Uint8Array(count);
  }

  get busy(): boolean {
    return this.active.length > 0;
  }

  clear() {
    this.values.fill(0);
    this.bytes.fill(0);
    this.hot.fill(0);
    this.active = [];
  }

  decay(dtMs: number) {
    if (dtMs <= 0 || this.active.length === 0) return;
    const step = dtMs / FLASH_DECAY_MS;
    const next: number[] = [];
    for (const index of this.active) {
      const value = Math.max(0, (this.values[index] ?? 0) - step);
      this.values[index] = value;
      this.bytes[index] = Math.round(value * 255);
      if (value > 0) next.push(index);
      else this.hot[index] = 0;
    }
    this.active = next;
  }

  mark(spikes: Uint8Array) {
    const count = Math.min(spikes.length, this.values.length);
    for (let index = 0; index < count; index++) {
      if (!spikes[index]) continue;
      this.values[index] = 1;
      this.bytes[index] = 255;
      if (this.hot[index] === 0) {
        this.hot[index] = 1;
        this.active.push(index);
      }
    }
  }
}

export function activityByGroup(
  values: Float32Array,
  groups: ReadonlyMap<string, Uint32Array>,
  threshold = 0.04,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, ids] of groups) {
    let hot = 0;
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index] ?? 0;
      if ((values[id] ?? 0) > threshold) hot += 1;
    }
    out[name] = ids.length === 0 ? 0 : hot / ids.length;
  }
  return out;
}
