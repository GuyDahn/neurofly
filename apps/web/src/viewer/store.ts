import { create } from "zustand";

export type ViewerStatus = "loading" | "ready" | "error";

type ViewerState = {
  status: ViewerStatus;
  error: string | null;
  progress: number;
  stimulating: Record<string, boolean>;
  silenced: Record<string, boolean>;
  activity: Record<string, number>;
  setStatus: (status: ViewerStatus, error?: string | null) => void;
  setProgress: (progress: number) => void;
  setStimulating: (colorGroup: string, on: boolean) => void;
  setSilenced: (colorGroup: string, on: boolean) => void;
  setActivity: (activity: Record<string, number>) => void;
  resetControls: () => void;
};

export const useViewerStore = create<ViewerState>((set) => ({
  status: "loading",
  error: null,
  progress: 0,
  stimulating: {},
  silenced: {},
  activity: {},
  setStatus: (status, error = null) => set({ status, error }),
  setProgress: (progress) => set({ progress }),
  setStimulating: (colorGroup, on) =>
    set((state) => ({
      stimulating: { ...state.stimulating, [colorGroup]: on },
    })),
  setSilenced: (colorGroup, on) =>
    set((state) => ({
      silenced: { ...state.silenced, [colorGroup]: on },
    })),
  setActivity: (activity) => set({ activity }),
  resetControls: () => set({ stimulating: {}, silenced: {}, activity: {} }),
}));
