export type ControlSpec = {
  colorGroup: string;
  name: string;
  label: string;
};

export type GroupSpec = {
  colorGroup: string;
  label: string;
  color: string;
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
  stimulusHz: number;
  stimulusMs: number;
  stimuli: ControlSpec[];
  silence: ControlSpec[];
  groups: GroupSpec[];
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
