import type { ControlSpec, GroupSpec, ModuleSpec } from "./types.js";

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function readModule(value: unknown): ModuleSpec {
  const record = object(value, "module.json");
  const assets = object(record.assets, "module.json assets");
  const stimulusHz = record.stimulusHz;
  const stimulusMs = record.stimulusMs;
  if (
    typeof stimulusHz !== "number" ||
    !Number.isFinite(stimulusHz) ||
    stimulusHz <= 0 ||
    stimulusHz > 2000
  ) {
    throw new Error("module.json stimulusHz must be between 0 and 2000");
  }
  if (
    typeof stimulusMs !== "number" ||
    !Number.isFinite(stimulusMs) ||
    stimulusMs <= 0
  ) {
    throw new Error("module.json stimulusMs must be a positive number");
  }
  const stimuli = readControls(record.stimuli, "stimuli");
  const silence = readControls(record.silence, "silence");
  const groups = readGroups(record.groups);
  if (stimuli.length < 1) {
    throw new Error("module.json needs a stimulable group");
  }
  const known = new Set(groups.map((group) => group.colorGroup));
  for (const control of [...stimuli, ...silence]) {
    if (!known.has(control.colorGroup)) {
      throw new Error(
        `module.json ${control.colorGroup} has no activity group`,
      );
    }
  }
  return {
    id: text(record.id, "id"),
    title: text(record.title, "title"),
    circuit: text(record.circuit, "circuit"),
    summary: text(record.summary, "summary"),
    assets: {
      gltf: text(assets.gltf, "assets.gltf"),
      graph: text(assets.graph, "assets.graph"),
      neurons: text(assets.neurons, "assets.neurons"),
    },
    stimulusHz,
    stimulusMs,
    stimuli,
    silence,
    groups,
  };
}

export function groupColor(module: ModuleSpec, colorGroup: string): string {
  const group = module.groups.find((item) => item.colorGroup === colorGroup);
  return group?.color ?? "#9ca3af";
}

export function missingGroups(
  module: ModuleSpec,
  present: ReadonlySet<string>,
): string[] {
  const needed = new Set<string>();
  for (const control of module.stimuli) needed.add(control.colorGroup);
  for (const control of module.silence) needed.add(control.colorGroup);
  for (const group of module.groups) needed.add(group.colorGroup);
  return [...needed].filter((group) => !present.has(group));
}

function readControls(value: unknown, field: string): ControlSpec[] {
  if (!Array.isArray(value)) {
    throw new Error(`module.json ${field} must be a list`);
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    const row = object(item, `module.json ${field}[${index}]`);
    const colorGroup = text(row.colorGroup, `${field}[${index}].colorGroup`);
    if (seen.has(colorGroup)) {
      throw new Error(`module.json repeats ${colorGroup} in ${field}`);
    }
    seen.add(colorGroup);
    return {
      colorGroup,
      name: text(row.name, `${field}[${index}].name`),
      label: text(row.label, `${field}[${index}].label`),
    };
  });
}

function readGroups(value: unknown): GroupSpec[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("module.json groups must be a list");
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    const row = object(item, `module.json groups[${index}]`);
    const colorGroup = text(row.colorGroup, `groups[${index}].colorGroup`);
    if (seen.has(colorGroup)) {
      throw new Error(`module.json repeats ${colorGroup} in groups`);
    }
    seen.add(colorGroup);
    const color = text(row.color, `groups[${index}].color`);
    if (!HEX.test(color)) {
      throw new Error(
        `module.json color for ${colorGroup} must be a hex color`,
      );
    }
    return {
      colorGroup,
      label: text(row.label, `groups[${index}].label`),
      color,
    };
  });
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${field} is not an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`module.json is missing ${field}`);
  }
  return value.trim();
}
