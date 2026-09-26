import type {
  ControlAction,
  ControlKind,
  ControlState,
  ModuleSpec,
} from "./types.js";

export const MAX_STEP_WORDS = 40;
export const MAX_GLOSS_WORDS = 3;

export type LessonGoal =
  | { type: "stimulate"; colorGroup: string }
  | { type: "silence"; colorGroup: string; on: boolean };

export type LessonStep = {
  id: string;
  /** What to do. Shown as soon as the step opens. */
  text: string;
  /** What just happened. Shown once the learner has acted and the puff is over. */
  result: string;
  /** Color groups drawn at full brightness. Everything else dims. */
  focus: string[];
  /** Controls unlocked before the goal is met. */
  controls: { stimulate: string[]; silence: string[] };
  goal: LessonGoal;
  /** Stimulus group the runner sends for the learner right after the goal. */
  puff: string | null;
};

export type LessonChoice = {
  text: string;
  correct: boolean;
  feedback: string;
};

export type LessonModule = {
  id: string;
  title: string;
  summary: string;
  circuit: string;
  /** Terms that need a short gloss in parentheses wherever they appear. */
  jargon: string[];
  steps: LessonStep[];
  check: { question: string; focus: string[]; choices: LessonChoice[] };
  freePlay: { title: string; text: string };
};

export type LessonPhase =
  | { kind: "step"; index: number; done: boolean }
  | { kind: "check"; picked: number | null }
  | { kind: "free" };

export function readLesson(value: unknown, module: ModuleSpec): LessonModule {
  const record = object(value, "lesson");
  const circuit = text(record.circuit, "circuit");
  if (circuit !== module.circuit) {
    throw new Error(`lesson is for ${circuit}, not ${module.circuit}`);
  }
  const groups = new Set(module.groups.map((group) => group.colorGroup));
  const stimuli = new Set(module.stimuli.map((item) => item.colorGroup));
  const silence = new Set(module.silence.map((item) => item.colorGroup));
  const steps = list(record.steps, "steps").map((item, index) =>
    readStep(item, `steps[${index}]`, { groups, stimuli, silence }),
  );
  if (steps.length === 0) throw new Error("lesson needs at least one step");
  const check = object(record.check, "check");
  const choices = list(check.choices, "check.choices").map((item, index) => {
    const row = object(item, `check.choices[${index}]`);
    if (typeof row.correct !== "boolean") {
      throw new Error(
        `lesson check.choices[${index}].correct must be true or false`,
      );
    }
    return {
      text: text(row.text, `check.choices[${index}].text`),
      correct: row.correct,
      feedback: text(row.feedback, `check.choices[${index}].feedback`),
    };
  });
  if (choices.filter((choice) => choice.correct).length !== 1) {
    throw new Error("lesson check needs exactly one correct choice");
  }
  const freePlay = object(record.freePlay, "freePlay");
  return {
    id: text(record.id, "id"),
    title: text(record.title, "title"),
    summary: text(record.summary, "summary"),
    circuit,
    jargon: list(record.jargon, "jargon").map((item, index) =>
      text(item, `jargon[${index}]`),
    ),
    steps,
    check: {
      question: text(check.question, "check.question"),
      focus: groupList(check.focus, "check.focus", groups),
      choices,
    },
    freePlay: {
      title: text(freePlay.title, "freePlay.title"),
      text: text(freePlay.text, "freePlay.text"),
    },
  };
}

/** How a control looks right now: open, open and pointed at, or locked. */
export function controlState(
  lesson: LessonModule,
  phase: LessonPhase,
  kind: ControlKind,
  colorGroup = "",
): ControlState {
  if (phase.kind === "free") return "open";
  if (kind === "reset") return "locked";
  if (phase.kind === "check") return kind === "stimulate" ? "open" : "locked";
  const step = lesson.steps[phase.index];
  if (!step) return "locked";
  const isGoal = step.goal.type === kind && step.goal.colorGroup === colorGroup;
  if (!phase.done) {
    if (isGoal) return "cue";
    return step.controls[kind].includes(colorGroup) ? "open" : "locked";
  }
  // After the goal, any puff may be replayed, but the silence the step asked
  // for stays put so the next step starts from the state it expects.
  if (kind === "stimulate") return "open";
  if (isGoal) return "locked";
  return step.controls.silence.includes(colorGroup) ? "open" : "locked";
}

export function meetsGoal(goal: LessonGoal, action: ControlAction): boolean {
  if (action.type === "reset" || action.type !== goal.type) return false;
  if (action.colorGroup !== goal.colorGroup) return false;
  if (goal.type === "silence" && action.type === "silence") {
    return action.on === goal.on;
  }
  return true;
}

export function focusFor(lesson: LessonModule, phase: LessonPhase): string[] {
  if (phase.kind === "step") return lesson.steps[phase.index]?.focus ?? [];
  if (phase.kind === "check") return lesson.check.focus;
  return [];
}

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Jargon terms whose first use in `value` is not followed by a short gloss,
 * e.g. "Kenyon cells (the smell sorters)".
 */
export function unglossed(value: string, jargon: readonly string[]): string[] {
  const missing: string[] = [];
  for (const term of jargon) {
    const pattern = new RegExp(`\\b${escape(term)}\\b`, "i");
    const found = pattern.exec(value);
    if (!found) continue;
    const after = value.slice(found.index + found[0].length);
    const gloss = /^ \(([^)]+)\)/.exec(after);
    const words = gloss ? wordCount(gloss[1] ?? "") : 0;
    if (words < 1 || words > MAX_GLOSS_WORDS) missing.push(term);
  }
  return missing;
}

function readStep(
  value: unknown,
  field: string,
  known: {
    groups: ReadonlySet<string>;
    stimuli: ReadonlySet<string>;
    silence: ReadonlySet<string>;
  },
): LessonStep {
  const row = object(value, field);
  const controls = object(row.controls, `${field}.controls`);
  const goalRow = object(row.goal, `${field}.goal`);
  const goalGroup = text(goalRow.colorGroup, `${field}.goal.colorGroup`);
  let goal: LessonGoal;
  if (goalRow.type === "stimulate") {
    if (!known.stimuli.has(goalGroup)) {
      throw new Error(`lesson ${field} cannot stimulate ${goalGroup}`);
    }
    goal = { type: "stimulate", colorGroup: goalGroup };
  } else if (goalRow.type === "silence") {
    if (!known.silence.has(goalGroup)) {
      throw new Error(`lesson ${field} cannot silence ${goalGroup}`);
    }
    if (typeof goalRow.on !== "boolean") {
      throw new Error(`lesson ${field}.goal.on must be true or false`);
    }
    goal = { type: "silence", colorGroup: goalGroup, on: goalRow.on };
  } else {
    throw new Error(`lesson ${field}.goal.type must be stimulate or silence`);
  }
  const step: LessonStep = {
    id: text(row.id, `${field}.id`),
    text: text(row.text, `${field}.text`),
    result: text(row.result, `${field}.result`),
    focus: groupList(row.focus, `${field}.focus`, known.groups),
    controls: {
      stimulate: groupList(
        controls.stimulate,
        `${field}.controls.stimulate`,
        known.stimuli,
      ),
      silence: groupList(
        controls.silence,
        `${field}.controls.silence`,
        known.silence,
      ),
    },
    goal,
    puff: null,
  };
  if (!step.controls[goal.type].includes(goal.colorGroup)) {
    throw new Error(`lesson ${field} locks the control its goal needs`);
  }
  if (row.puff !== undefined) {
    const puff = text(row.puff, `${field}.puff`);
    if (!known.stimuli.has(puff)) {
      throw new Error(`lesson ${field} cannot puff ${puff}`);
    }
    step.puff = puff;
  }
  return step;
}

function groupList(
  value: unknown,
  field: string,
  known: ReadonlySet<string>,
): string[] {
  return list(value, field).map((item, index) => {
    const group = text(item, `${field}[${index}]`);
    if (!known.has(group)) {
      throw new Error(`lesson ${field} names unknown group ${group}`);
    }
    return group;
  });
}

function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`lesson ${field} must be a list`);
  return value;
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`lesson ${field} is not an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`lesson is missing ${field}`);
  }
  return value.trim();
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
