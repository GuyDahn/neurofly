export type ViewerCommand =
  | { type: "stimulate"; colorGroup: string }
  | { type: "silence"; colorGroup: string; on: boolean }
  /** Clears the brain. A seed also changes the noise the next puffs draw from. */
  | { type: "reset"; seed?: number };

const queue: ViewerCommand[] = [];
let poker = () => {};

export function setPoker(poke: () => void) {
  poker = poke;
}

export function requestViewerFrame() {
  poker();
}

export function enqueue(command: ViewerCommand) {
  if (command.type === "reset") queue.length = 0;
  queue.push(command);
  poker();
}

export function drainCommands(): ViewerCommand[] {
  return queue.splice(0, queue.length);
}
