import type { Cascade } from "./cascade.js";
import {
  buildScene,
  flashAt,
  STILL_WINDOW_MS,
  stillMoment,
  type Scene,
} from "./cascade-scene.js";

const LEVELS = 5;
const CONTEXT_COLOR = "#71717a";

/**
 * The loop's still frame as a standalone SVG: the resting circuit, then every
 * neuron that fired in the moments before the jump, brighter the more recent.
 */
export function cascadeSvg(
  cascade: Cascade,
  width: number,
  height: number,
): string {
  const scene = buildScene(cascade, width, height, 0.04);
  const levels = flashAt(
    scene,
    stillMoment(cascade),
    new Float32Array(cascade.neuronGroup.length),
    STILL_WINDOW_MS,
  );
  const layers: string[] = [];
  const groups = cascade.groups.length;
  for (let group = -1; group < groups; group++) {
    const d = pathData(
      scene,
      (neuron) => cascade.neuronGroup[neuron] === group,
    );
    if (!d) continue;
    const info = cascade.groups[group];
    const few = (info?.count ?? Infinity) <= 20;
    layers.push(
      stroke(
        d,
        info?.color ?? CONTEXT_COLOR,
        info ? (few ? 0.6 : 0.34) : 0.22,
        info ? (few ? 2.4 : 1) : 0.8,
      ),
    );
  }
  for (let group = -1; group < groups; group++) {
    const info = cascade.groups[group];
    const few = (info?.count ?? Infinity) <= 20;
    for (let level = 1; level <= LEVELS; level++) {
      const d = pathData(
        scene,
        (neuron) =>
          cascade.neuronGroup[neuron] === group &&
          Math.ceil((levels[neuron] ?? 0) * LEVELS) === level,
      );
      if (!d) continue;
      const strength = level / LEVELS;
      if (!info) {
        layers.push(stroke(d, "#a1a1aa", strength * 0.22, 0.9));
        continue;
      }
      if (few) {
        layers.push(stroke(d, info.color, strength * 0.9, 7, "glow"));
      }
      layers.push(stroke(d, info.color, strength, few ? 3 : 1.4));
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter></defs>`,
    ...layers,
    "</svg>",
  ].join("");
}

function stroke(
  d: string,
  color: string,
  opacity: number,
  width: number,
  filter?: string,
): string {
  const blur = filter ? ` filter="url(#${filter})"` : "";
  return `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${opacity.toFixed(3)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${blur}/>`;
}

function pathData(scene: Scene, pick: (neuron: number) => boolean): string {
  const { offset } = scene.cascade.paths;
  const { xy } = scene;
  const parts: string[] = [];
  const neurons = scene.cascade.neuronGroup.length;
  for (let neuron = 0; neuron < neurons; neuron++) {
    if (!pick(neuron)) continue;
    const start = (offset[neuron] ?? 0) / 3;
    const end = (offset[neuron + 1] ?? 0) / 3;
    if (end - start < 2) continue;
    for (let point = start; point < end; point++) {
      const x = (xy[point * 2] ?? 0).toFixed(1);
      const y = (xy[point * 2 + 1] ?? 0).toFixed(1);
      parts.push(`${point === start ? "M" : "L"}${x} ${y}`);
    }
  }
  return parts.join("");
}
