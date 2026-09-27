import { fadeAt, type Cascade } from "./cascade.js";
import {
  buildScene,
  dotsAt,
  FLASH_MS,
  flashAt,
  flyClock,
  STILL_WINDOW_MS,
  stillMoment,
  type Scene,
} from "./cascade-scene.js";

export type LoopFrame = {
  /** Fly ms since the swatter, or null during the lead-in. */
  flyMs: number | null;
  /** Per lesson group: has it fired yet on this pass? */
  fired: boolean[];
};

/** Flash levels draw in this many brightness steps, one path each. */
const LEVELS = 6;
const MAX_DPR = 2;
/** A frame gap longer than this (a background tab, a debugger) counts as this. */
const MAX_STEP_MS = 100;
const CONTEXT_COLOR = "#71717a";
const CONTEXT_LIT = "#a1a1aa";

type GroupStyle = {
  base: string;
  lit: string;
  /** Few big cells draw thick and glow. Many small ones draw thin. */
  few: boolean;
};

/**
 * Draws the escape loop on a 2D canvas. The resting circuit is painted once
 * into a cached layer; each frame copies it and adds only the neurons that
 * are flashing, so a school laptop keeps up.
 */
export class LoopPlayer {
  private readonly context: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly levels: Float32Array;
  private readonly styles: GroupStyle[];
  private scene: Scene | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private elapsed = 0;
  private last: number | null = null;
  private frame: number | null = null;
  private playing = false;
  private visible = true;
  private still = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cascade: Cascade,
    private readonly onFrame: (frame: LoopFrame) => void,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot draw the animation.");
    this.context = context;
    this.base = document.createElement("canvas");
    this.levels = new Float32Array(cascade.neuronGroup.length);
    this.styles = cascade.groups.map((group) => ({
      base: group.color,
      lit: mixWithWhite(group.color, 0.35),
      few: group.count <= 20,
    }));
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  resize(width: number, height: number) {
    if (width < 2 || height < 2) return;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    for (const target of [this.canvas, this.base]) {
      target.width = Math.round(width * this.dpr);
      target.height = Math.round(height * this.dpr);
    }
    this.scene = buildScene(this.cascade, width, height);
    this.paintBase(this.scene);
    this.redraw();
  }

  play() {
    if (this.still) {
      this.still = false;
      this.elapsed = 0;
    }
    this.playing = true;
    this.schedule();
  }

  pause() {
    this.playing = false;
    this.cancel();
    this.last = null;
  }

  /** The cascade at its fullest, for reduced motion and before playing. */
  showStill() {
    this.pause();
    this.still = true;
    this.redraw();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (visible) this.schedule();
    else {
      this.cancel();
      this.last = null;
    }
  }

  dispose() {
    this.pause();
    this.base.width = 0;
    this.base.height = 0;
  }

  private schedule() {
    if (this.frame !== null || !this.playing || !this.visible) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private cancel() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private readonly tick = (now: number) => {
    this.frame = null;
    if (!this.playing || !this.visible) return;
    const step =
      this.last === null ? 0 : Math.min(now - this.last, MAX_STEP_MS);
    this.last = now;
    this.elapsed += step;
    this.redraw();
    this.schedule();
  };

  private redraw() {
    const scene = this.scene;
    if (!scene) return;
    if (this.still) {
      this.draw(scene, stillMoment(this.cascade), STILL_WINDOW_MS, 1);
    } else {
      this.draw(
        scene,
        this.elapsed,
        FLASH_MS,
        fadeAt(this.elapsed, this.cascade),
      );
    }
  }

  private paintBase(scene: Scene) {
    const context = this.base.getContext("2d");
    if (!context) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.width, this.height);
    context.lineJoin = "round";
    context.lineCap = "round";
    const groups = this.cascade.groups.length;
    for (let group = -1; group < groups; group++) {
      const path = new Path2D();
      let any = false;
      for (let neuron = 0; neuron < this.cascade.neuronGroup.length; neuron++) {
        if (this.cascade.neuronGroup[neuron] !== group) continue;
        any = traceNeuron(path, scene, neuron) || any;
      }
      if (!any) continue;
      const style = this.styles[group];
      context.strokeStyle = style?.base ?? CONTEXT_COLOR;
      context.globalAlpha = !style ? 0.24 : style.few ? 0.6 : 0.34;
      context.lineWidth = !style ? 0.75 : style.few ? 2 : 0.9;
      context.stroke(path);
    }
    context.globalAlpha = 1;
  }

  private draw(scene: Scene, wallMs: number, windowMs: number, fade: number) {
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "copy";
    context.globalAlpha = 1;
    context.drawImage(this.base, 0, 0);
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.globalCompositeOperation = "lighter";
    context.lineJoin = "round";
    context.lineCap = "round";

    const levels = flashAt(scene, wallMs, this.levels, windowMs);
    const groups = this.cascade.groups.length;
    if (fade > 0) {
      for (let group = -1; group < groups; group++) {
        const style = this.styles[group];
        for (let level = 1; level <= LEVELS; level++) {
          const path = new Path2D();
          let any = false;
          for (let neuron = 0; neuron < levels.length; neuron++) {
            if (this.cascade.neuronGroup[neuron] !== group) continue;
            const value = levels[neuron] ?? 0;
            if (Math.ceil(value * LEVELS) !== level) continue;
            any = traceNeuron(path, scene, neuron) || any;
          }
          if (!any) continue;
          const strength = (level / LEVELS) * fade;
          context.strokeStyle = style?.lit ?? CONTEXT_LIT;
          context.lineWidth = !style ? 0.9 : style.few ? 2.6 : 1.3;
          context.globalAlpha = style ? strength : strength * 0.22;
          if (style?.few) {
            context.shadowColor = style.base;
            context.shadowBlur = 14 * strength;
          }
          context.stroke(path);
          context.shadowBlur = 0;
        }
      }
      for (const dot of dotsAt(scene, wallMs)) {
        const style = this.styles[dot.group];
        if (!style) continue;
        const radius = style.few ? 3.6 : 2.2;
        const strength = fade * (1 - 0.6 * dot.progress);
        context.fillStyle = style.lit;
        context.globalAlpha = strength * 0.28;
        context.beginPath();
        context.arc(dot.x, dot.y, radius * 2.6, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = strength;
        context.beginPath();
        context.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";

    const flyMs = flyClock(this.cascade, wallMs);
    this.onFrame({
      flyMs,
      fired: this.cascade.groups.map(
        (group) =>
          flyMs !== null &&
          group.firstTick !== null &&
          flyMs >= group.firstTick * this.cascade.tickMs,
      ),
    });
  }
}

/** Adds a neuron's polyline to `path`. False if it has no line to draw. */
function traceNeuron(path: Path2D, scene: Scene, neuron: number): boolean {
  const { offset } = scene.cascade.paths;
  const start = (offset[neuron] ?? 0) / 3;
  const end = (offset[neuron + 1] ?? 0) / 3;
  if (end - start < 2) return false;
  const { xy } = scene;
  path.moveTo(xy[start * 2] ?? 0, xy[start * 2 + 1] ?? 0);
  for (let point = start + 1; point < end; point++) {
    path.lineTo(xy[point * 2] ?? 0, xy[point * 2 + 1] ?? 0);
  }
  return true;
}

function mixWithWhite(hex: string, share: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    return Math.round(c + (255 - c) * share);
  };
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}
