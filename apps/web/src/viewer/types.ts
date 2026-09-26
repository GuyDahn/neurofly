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
