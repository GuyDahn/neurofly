import type { ModuleSpec } from "./types.js";

/**
 * A run someone can share: which lesson, which noise seed, and every button
 * press with the simulator tick it landed on. Ticks make the replay exact.
 * Wall-clock offsets only pace the pauses between presses.
 */
export type ReplayCommand =
  | { type: "stimulate"; colorGroup: string }
  | { type: "silence"; colorGroup: string; on: boolean };

export type ReplayAction = {
  /** Session tick (0.1 ms) the command was applied on. */
  tick: number;
  /** Wall-clock ms since the recording started, for pacing only. */
  wallMs: number;
  command: ReplayCommand;
};

export type Replay = {
  lessonId: string;
  seed: number;
  actions: ReplayAction[];
};

export const REPLAY_PARAM = "r";

const VERSION = 1;
/** Longer than any real lesson or free-play session, short enough to never stall a page. */
export const MAX_ACTIONS = 400;
/** Two minutes of fly time. */
export const MAX_TICKS = 1_200_000;
const MAX_TEXT_BYTES = 64;
const MAX_GROUPS = 64;
const MAX_PARAM_LENGTH = 4096;
/** Wall offsets are stored in 10 ms steps and capped, since they only pace the replay. */
const WALL_STEP_MS = 10;
const MAX_WALL_GAP_MS = 600_000;

const OP_STIMULATE = 0;
const OP_SILENCE_OFF = 1;
const OP_SILENCE_ON = 2;

/** Why a share link cannot play. The viewer says it in the reader's language, from viewer.replay.errors. */
export type ReplayErrorCode =
  | "empty"
  | "version"
  | "seed"
  | "tooMany"
  | "tooLong"
  | "broken"
  | "unknownLesson"
  | "unknownButton";

export class ReplayError extends Error {
  constructor(readonly code: ReplayErrorCode) {
    super(`replay: ${code}`);
  }
}

export function encodeReplay(replay: Replay): string {
  const bytes: number[] = [VERSION];
  writeText(bytes, replay.lessonId);
  writeVarint(bytes, replay.seed);
  const table: string[] = [];
  for (const action of replay.actions) {
    if (!table.includes(action.command.colorGroup)) {
      table.push(action.command.colorGroup);
    }
  }
  if (table.length > MAX_GROUPS) {
    throw new Error(`A replay can name at most ${MAX_GROUPS} cell groups.`);
  }
  writeVarint(bytes, table.length);
  for (const name of table) writeText(bytes, name);
  writeVarint(bytes, replay.actions.length);
  let tick = 0;
  let wall = 0;
  for (const action of replay.actions) {
    if (action.tick < tick || !Number.isInteger(action.tick)) {
      throw new Error("Replay ticks must be whole and in order.");
    }
    writeVarint(bytes, action.tick - tick);
    tick = action.tick;
    // Track the wall time the decoder will rebuild, so rounding never drifts.
    const gap = Math.min(Math.max(action.wallMs - wall, 0), MAX_WALL_GAP_MS);
    const steps = Math.round(gap / WALL_STEP_MS);
    writeVarint(bytes, steps);
    wall += steps * WALL_STEP_MS;
    const group = table.indexOf(action.command.colorGroup);
    const op =
      action.command.type === "stimulate"
        ? OP_STIMULATE
        : action.command.on
          ? OP_SILENCE_ON
          : OP_SILENCE_OFF;
    bytes.push((group << 2) | op);
  }
  return toBase64Url(Uint8Array.from(bytes));
}

export function decodeReplay(text: string): Replay {
  if (text.length === 0 || text.length > MAX_PARAM_LENGTH) {
    throw new ReplayError("empty");
  }
  const bytes = fromBase64Url(text);
  const reader = { bytes, at: 0 };
  if (readByte(reader) !== VERSION) {
    throw new ReplayError("version");
  }
  const lessonId = readText(reader);
  const seed = readVarint(reader);
  if (seed > 0xffffffff) throw new ReplayError("seed");
  const groupCount = readVarint(reader);
  if (groupCount > MAX_GROUPS) throw brokenLink();
  const table: string[] = [];
  for (let index = 0; index < groupCount; index++) table.push(readText(reader));
  const count = readVarint(reader);
  if (count > MAX_ACTIONS) {
    throw new ReplayError("tooMany");
  }
  const actions: ReplayAction[] = [];
  let tick = 0;
  let wall = 0;
  for (let index = 0; index < count; index++) {
    tick += readVarint(reader);
    wall += readVarint(reader) * WALL_STEP_MS;
    if (tick > MAX_TICKS) {
      throw new ReplayError("tooLong");
    }
    const op = readByte(reader);
    const colorGroup = table[op >> 2];
    if (colorGroup === undefined) throw brokenLink();
    const kind = op & 3;
    let command: ReplayCommand;
    if (kind === OP_STIMULATE) command = { type: "stimulate", colorGroup };
    else if (kind === OP_SILENCE_OFF || kind === OP_SILENCE_ON) {
      command = { type: "silence", colorGroup, on: kind === OP_SILENCE_ON };
    } else throw brokenLink();
    actions.push({ tick, wallMs: wall, command });
  }
  if (reader.at !== bytes.length) throw brokenLink();
  return { lessonId, seed, actions };
}

/** Why this replay cannot run on this module, or null if it can. */
export function replayProblem(
  replay: Replay,
  module: ModuleSpec,
): ReplayErrorCode | null {
  const stimuli = new Set(module.stimuli.map((item) => item.colorGroup));
  const silence = new Set(module.silence.map((item) => item.colorGroup));
  for (const action of replay.actions) {
    const { command } = action;
    const known =
      command.type === "stimulate"
        ? stimuli.has(command.colorGroup)
        : silence.has(command.colorGroup);
    if (!known) {
      return "unknownButton";
    }
  }
  return null;
}

/** Link to a lesson page that replays `replay`, or the plain page when there is nothing to replay. */
export function replayUrl(
  origin: string,
  path: string,
  replay: Replay,
): string {
  const base = `${origin}${path}`;
  if (replay.actions.length === 0) return base;
  return `${base}?${REPLAY_PARAM}=${encodeReplay(replay)}`;
}

function brokenLink(): ReplayError {
  return new ReplayError("broken");
}

function writeVarint(bytes: number[], value: number) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("Replay numbers must be whole and not negative.");
  }
  let rest = value;
  while (rest >= 0x80) {
    bytes.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  bytes.push(rest);
}

function writeText(bytes: number[], value: string) {
  const encoded = new TextEncoder().encode(value);
  if (encoded.length === 0 || encoded.length > MAX_TEXT_BYTES) {
    throw new Error("Replay names must be short.");
  }
  writeVarint(bytes, encoded.length);
  for (const byte of encoded) bytes.push(byte);
}

type Reader = { bytes: Uint8Array; at: number };

function readByte(reader: Reader): number {
  const value = reader.bytes[reader.at];
  if (value === undefined) throw brokenLink();
  reader.at += 1;
  return value;
}

function readVarint(reader: Reader): number {
  let value = 0;
  let scale = 1;
  for (let count = 0; count < 8; count++) {
    const byte = readByte(reader);
    value += (byte & 0x7f) * scale;
    if ((byte & 0x80) === 0) return value;
    scale *= 0x80;
  }
  throw brokenLink();
}

function readText(reader: Reader): string {
  const length = readVarint(reader);
  if (length === 0 || length > MAX_TEXT_BYTES) throw brokenLink();
  if (reader.at + length > reader.bytes.length) throw brokenLink();
  const slice = reader.bytes.subarray(reader.at, reader.at + length);
  reader.at += length;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(slice);
  } catch {
    throw brokenLink();
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw brokenLink();
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  let binary: string;
  try {
    binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  } catch {
    throw brokenLink();
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
