import type {
  CompassSpec,
  ControlSpec,
  GroupMatch,
  GroupSpec,
  ModuleSpec,
} from "./types.js";

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
  const seed = record.seed ?? 1;
  if (
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff
  ) {
    throw new Error("module.json seed must be an integer from 0 to 2^32-1");
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
  const compass =
    record.compass === undefined ? null : readCompass(record.compass, known);
  const frame = strings(record.frame, "frame");
  for (const name of frame) {
    if (!known.has(name)) {
      throw new Error(`module.json frame names unknown group ${name}`);
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
    seed,
    stimulusHz,
    stimulusMs,
    stimuli,
    silence,
    groups,
    frame,
    compass,
  };
}

export function groupColor(module: ModuleSpec, colorGroup: string): string {
  const group = module.groups.find((item) => item.colorGroup === colorGroup);
  return group?.color ?? "#9ca3af";
}

/** Module groups that matched no neuron in the loaded circuit. */
export function emptyGroups(
  module: ModuleSpec,
  groups: ReadonlyMap<string, Uint32Array>,
): string[] {
  return module.groups
    .map((group) => group.colorGroup)
    .filter((name) => (groups.get(name)?.length ?? 0) === 0);
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
      match:
        row.match === undefined
          ? { colorGroups: [colorGroup], types: [], ids: [] }
          : readMatch(row.match, `groups[${index}].match`),
    };
  });
}

function readMatch(value: unknown, field: string): GroupMatch {
  const row = object(value, `module.json ${field}`);
  const match: GroupMatch = {
    colorGroups: strings(row.colorGroups, `${field}.colorGroups`),
    types: strings(row.types, `${field}.types`),
    ids: bodyIds(row.ids, `${field}.ids`),
  };
  if (match.colorGroups.length + match.types.length + match.ids.length === 0) {
    throw new Error(`module.json ${field} matches nothing`);
  }
  return match;
}

function readCompass(value: unknown, known: ReadonlySet<string>): CompassSpec {
  const row = object(value, "module.json compass");
  const colorGroup = text(row.colorGroup, "compass.colorGroup");
  if (!known.has(colorGroup)) {
    throw new Error(`module.json compass reads unknown group ${colorGroup}`);
  }
  if (!Array.isArray(row.wedges) || row.wedges.length < 3) {
    throw new Error("module.json compass needs at least three wedges");
  }
  const wedges = row.wedges.map((item, index) => {
    const wedge = object(item, `module.json compass.wedges[${index}]`);
    const angle = wedge.angle;
    if (typeof angle !== "number" || !Number.isFinite(angle)) {
      throw new Error(`module.json compass.wedges[${index}].angle is missing`);
    }
    const ids = bodyIds(wedge.ids, `compass.wedges[${index}].ids`);
    if (ids.length === 0) {
      throw new Error(`module.json compass.wedges[${index}] has no cells`);
    }
    return {
      glomerulus: text(wedge.glomerulus, `compass.wedges[${index}].glomerulus`),
      angle: ((angle % 360) + 360) % 360,
      ids,
    };
  });
  return { colorGroup, wedges };
}

function strings(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`module.json ${field} must be a list`);
  }
  return value.map((item, index) => text(item, `${field}[${index}]`));
}

function bodyIds(value: unknown, field: string): number[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`module.json ${field} must be a list`);
  }
  return value.map((item) => {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0) {
      throw new Error(`module.json ${field} must hold body ids`);
    }
    return item;
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
