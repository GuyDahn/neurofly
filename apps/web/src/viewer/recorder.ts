import type { ViewerCommand } from "./commands.js";
import { Playback } from "./playback.js";
import type { Replay, ReplayAction } from "./replay.js";

/**
 * Every command the scene has applied since the last reset, each with the
 * session tick it landed on. A reset wipes the brain, so it also starts a new
 * recording: nothing before it can change what happens after it.
 */
let seed = 1;
let startedWall = 0;
const actions: ReplayAction[] = [];

let playback: Playback | null = null;

export function restartRecording(nextSeed: number, wallMs: number) {
  seed = nextSeed;
  startedWall = wallMs;
  actions.length = 0;
}

export function recordCommand(
  command: ViewerCommand,
  tick: number,
  wallMs: number,
) {
  if (command.type === "reset") return;
  actions.push({
    tick,
    wallMs: Math.max(0, wallMs - startedWall),
    command:
      command.type === "stimulate"
        ? { type: "stimulate", colorGroup: command.colorGroup }
        : { type: "silence", colorGroup: command.colorGroup, on: command.on },
  });
}

export function recording(lessonId: string): Replay {
  return { lessonId, seed, actions: actions.map((action) => ({ ...action })) };
}

export function startPlayback(replay: Replay) {
  playback = new Playback(replay);
}

export function stopPlayback() {
  playback = null;
}

export function activePlayback(): Playback | null {
  return playback;
}
