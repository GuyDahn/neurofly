import type { Replay, ReplayCommand } from "./replay.js";
import type { StepResult } from "./session.js";

/** Longest quiet pause a replay keeps between two presses. */
export const MAX_PAUSE_MS = 2500;
/** Pause before the first press, so the viewer sees the brain at rest. */
export const FIRST_PAUSE_MS = 700;

type Stepper = {
  readonly clock: number;
  advance(ticks: number, keep?: boolean): StepResult;
};

export type FrameOutcome = {
  /** Spikes from every tick this frame ran, or null if the clock did not move. */
  result: StepResult | null;
  /** Presses applied this frame. */
  applied: number;
  /** Ticks of the budget left once the last press has landed. */
  left: number;
};

/**
 * Plays a shared run back on a session. Each press lands on the exact tick it
 * was recorded on, so the cascade repeats spike for spike. Between presses the
 * replay keeps the recorded pause, but only while the brain is quiet, and
 * never longer than MAX_PAUSE_MS.
 */
export class Playback {
  private next = 0;
  /** Wall time of the last press, or of the first frame. Null until then. */
  private lastWall: number | null = null;
  private lastRecordedWall = 0;

  constructor(readonly replay: Replay) {}

  get applied(): number {
    return this.next;
  }

  get total(): number {
    return this.replay.actions.length;
  }

  get finished(): boolean {
    return this.next >= this.replay.actions.length;
  }

  frame(
    session: Stepper,
    budget: number,
    nowWall: number,
    quiet: () => boolean,
    apply: (command: ReplayCommand) => void,
  ): FrameOutcome {
    let result: StepResult | null = null;
    const finished: string[] = [];
    let applied = 0;
    let left = budget;
    let since = this.lastWall ?? nowWall;
    this.lastWall = since;
    while (!this.finished) {
      const action = this.replay.actions[this.next];
      if (!action) break;
      if (session.clock >= action.tick) {
        const pause =
          this.next === 0
            ? Math.min(action.wallMs, FIRST_PAUSE_MS)
            : Math.min(action.wallMs - this.lastRecordedWall, MAX_PAUSE_MS);
        if (quiet() && nowWall - since < pause) break;
        apply(action.command);
        since = nowWall;
        this.lastWall = nowWall;
        this.lastRecordedWall = action.wallMs;
        this.next += 1;
        applied += 1;
        continue;
      }
      if (left <= 0) break;
      const ticks = Math.min(left, action.tick - session.clock);
      const step = session.advance(ticks, result !== null);
      finished.push(...step.finished);
      result = { spikes: step.spikes, finished };
      left -= ticks;
    }
    return { result, applied, left: this.finished ? left : 0 };
  }
}
