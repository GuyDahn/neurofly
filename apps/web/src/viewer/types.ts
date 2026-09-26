export type ControlSpec = {
  colorGroup: string;
  name: string;
  label: string;
};

/** Which neurons a group holds. A neuron matching any list is in. */
export type GroupMatch = {
  /** Baked `colorGroup` values from neurons.json. */
  colorGroups: string[];
  /** MaleCNS cell types from neurons.json. */
  types: string[];
  /** MaleCNS body ids, for cells a type alone cannot pick out. */
  ids: number[];
};

export type GroupSpec = {
  colorGroup: string;
  label: string;
  color: string;
  match: GroupMatch;
};

export type CompassWedge = {
  /** Protocerebral bridge glomerulus of the wedge's E-PG neurons, e.g. R4. */
  glomerulus: string;
  /** Degrees clockwise from dorsal, seen from behind the fly. */
  angle: number;
  ids: number[];
};

/** A dial that reads the heading bump off the compass neurons. */
export type CompassSpec = {
  colorGroup: string;
  wedges: CompassWedge[];
};

export type ModuleSpec = {
  id: string;
  title: string;
  circuit: string;
  summary: string;
  assets: {
    gltf: string;
    graph: string;
    neurons: string;
  };
  /** Noise seed a fresh session starts from, so a lesson plays the same run. */
  seed: number;
  stimulusHz: number;
  stimulusMs: number;
  stimuli: ControlSpec[];
  silence: ControlSpec[];
  groups: GroupSpec[];
  /** Groups the camera frames at the start. Empty frames the whole circuit. */
  frame: string[];
  compass: CompassSpec | null;
};

export type ControlKind = "stimulate" | "silence" | "reset";

export type ControlAction =
  | { type: "stimulate"; colorGroup: string }
  | { type: "silence"; colorGroup: string; on: boolean }
  | { type: "reset" };

/** open: usable. cue: usable and the thing to tap next. locked: shown but off. */
export type ControlState = "open" | "cue" | "locked";

export type ControlGate = (
  kind: ControlKind,
  colorGroup?: string,
) => ControlState;
