import { create } from "zustand";
import type { CompassReadout } from "./compass.js";
import type { LoadErrorCode } from "./load-circuit.js";

export type ViewerStatus = "loading" | "ready" | "error";

/** The puff that is running now, in fly time. */
export type PuffClock = {
  colorGroup: string;
  elapsedMs: number;
  totalMs: number;
};

export type PlaybackState = {
  applied: number;
  total: number;
  /** Every press has landed and the brain has gone quiet. */
  done: boolean;
};

type ViewerState = {
  status: ViewerStatus;
  /** Why the circuit did not load. The stage says it in the reader's language. */
  error: LoadErrorCode | null;
  progress: number;
  stimulating: Record<string, boolean>;
  silenced: Record<string, boolean>;
  activity: Record<string, number>;
  /** Color groups drawn at full brightness. Empty means all of them. */
  focus: string[];
  puff: PuffClock | null;
  playback: PlaybackState | null;
  /** Live heading readout of the loaded circuit, if it has a compass. */
  compass: CompassReadout | null;
  /**
   * Module id of the circuit the scene is running, or null while one loads.
   * Lessons and replays wait for their own circuit before sending commands,
   * so the circuit a learner just left never takes them.
   */
  circuit: string | null;
  setStatus: (status: ViewerStatus, error?: LoadErrorCode | null) => void;
  setProgress: (progress: number) => void;
  setStimulating: (colorGroup: string, on: boolean) => void;
  setSilenced: (colorGroup: string, on: boolean) => void;
  setActivity: (activity: Record<string, number>) => void;
  setFocus: (focus: string[]) => void;
  setPuff: (puff: PuffClock | null) => void;
  setPlayback: (playback: PlaybackState | null) => void;
  setCompass: (compass: CompassReadout | null) => void;
  setCircuit: (circuit: string | null) => void;
  resetControls: () => void;
};

export const useViewerStore = create<ViewerState>((set) => ({
  status: "loading",
  error: null,
  progress: 0,
  stimulating: {},
  silenced: {},
  activity: {},
  focus: [],
  puff: null,
  playback: null,
  compass: null,
  circuit: null,
  setStatus: (status, error = null) => set({ status, error }),
  setProgress: (progress) => set({ progress }),
  setStimulating: (colorGroup, on) =>
    set((state) =>
      state.stimulating[colorGroup] === on
        ? state
        : { stimulating: { ...state.stimulating, [colorGroup]: on } },
    ),
  setSilenced: (colorGroup, on) =>
    set((state) =>
      (state.silenced[colorGroup] === true) === on
        ? state
        : { silenced: { ...state.silenced, [colorGroup]: on } },
    ),
  setActivity: (activity) => set({ activity }),
  setFocus: (focus) => set({ focus }),
  setPuff: (puff) => set({ puff }),
  setPlayback: (playback) => set({ playback }),
  setCompass: (compass) => set({ compass }),
  setCircuit: (circuit) => set({ circuit }),
  resetControls: () =>
    set({ stimulating: {}, silenced: {}, activity: {}, puff: null }),
}));
