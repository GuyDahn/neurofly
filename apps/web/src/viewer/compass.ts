import type { CompassSpec } from "./types.js";

export type Wedge = {
  glomerulus: string;
  /** Radians clockwise from dorsal, seen from behind the fly. */
  angle: number;
  neurons: Uint32Array;
};

/** Wall-clock time constant, in ms, for the needle settling on a new heading. */
export const NEEDLE_TAU_MS = 220;

export function compassWedges(
  spec: CompassSpec,
  indexOf: ReadonlyMap<number, number>,
): Wedge[] {
  return spec.wedges.map((wedge) => {
    const neurons: number[] = [];
    for (const id of wedge.ids) {
      const index = indexOf.get(id);
      if (index !== undefined) neurons.push(index);
    }
    if (neurons.length === 0) {
      throw new Error(`The compass wedge ${wedge.glomerulus} has no neurons.`);
    }
    return {
      glomerulus: wedge.glomerulus,
      angle: (wedge.angle * Math.PI) / 180,
      neurons: Uint32Array.from(neurons),
    };
  });
}

/** Mean flash brightness of each wedge's compass neurons, 0 to 1. */
export function wedgeLevels(
  values: Float32Array,
  wedges: readonly Wedge[],
  out: Float32Array,
) {
  for (let at = 0; at < wedges.length; at++) {
    const neurons = wedges[at]?.neurons;
    if (!neurons || neurons.length === 0) {
      out[at] = 0;
      continue;
    }
    let sum = 0;
    for (let k = 0; k < neurons.length; k++)
      sum += values[neurons[k] ?? 0] ?? 0;
    out[at] = sum / neurons.length;
  }
}

export type Heading = {
  /** Radians clockwise from dorsal, seen from behind the fly. */
  angle: number;
  /** 0 when nothing is lit or the ring is lit evenly, 1 for one bright wedge. */
  strength: number;
};

/** Population vector of the wedge levels. */
export function headingOf(
  levels: Float32Array,
  wedges: readonly Wedge[],
): { x: number; y: number; total: number } {
  let x = 0;
  let y = 0;
  let total = 0;
  for (let at = 0; at < wedges.length; at++) {
    const level = levels[at] ?? 0;
    const angle = wedges[at]?.angle ?? 0;
    x += level * Math.sin(angle);
    y += level * Math.cos(angle);
    total += level;
  }
  return { x, y, total };
}

/**
 * The live readout the dial draws: wedge levels straight from the flashes and
 * a needle that eases toward the population vector so bursts do not jitter it.
 */
export class CompassReadout {
  readonly levels: Float32Array;
  private x = 0;
  private y = 0;
  private weight = 0;
  private readonly listeners = new Set<() => void>();

  constructor(readonly wedges: readonly Wedge[]) {
    this.levels = new Float32Array(wedges.length);
  }

  /** Reads the flashes after a frame. Returns true while the needle is still moving. */
  update(values: Float32Array, wallMs: number): boolean {
    wedgeLevels(values, this.wedges, this.levels);
    const now = headingOf(this.levels, this.wedges);
    const keep = Math.exp(-Math.max(wallMs, 0) / NEEDLE_TAU_MS);
    this.x = this.x * keep + now.x * (1 - keep);
    this.y = this.y * keep + now.y * (1 - keep);
    this.weight = this.weight * keep + now.total * (1 - keep);
    this.emit();
    return this.weight > 1e-3;
  }

  clear() {
    this.levels.fill(0);
    this.x = 0;
    this.y = 0;
    this.weight = 0;
    this.emit();
  }

  heading(): Heading {
    const length = Math.hypot(this.x, this.y);
    if (this.weight <= 1e-4 || length <= 1e-6) return { angle: 0, strength: 0 };
    return {
      angle: Math.atan2(this.x, this.y),
      strength: Math.min(1, length / this.weight),
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
