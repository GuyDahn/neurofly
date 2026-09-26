import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { writeFocus } from "../apps/web/src/viewer/groups.js";
import {
  controlState,
  focusFor,
  glossParts,
  MAX_STEP_WORDS,
  meetsGoal,
  readLesson,
  unglossed,
  wordCount,
  type LessonPhase,
} from "../apps/web/src/viewer/lesson.js";
import { readModule } from "../apps/web/src/viewer/module.js";
import { findLesson, LESSONS } from "../apps/web/src/viewer/modules.js";

function json(path: string): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../apps/web/content/${path}`, import.meta.url),
      "utf8",
    ),
  );
}

const circuit = readModule(json("olfactory/module.json"));
const raw = json("modules/smell-memory.json");
const lesson = readLesson(raw, circuit);

describe("lesson registry", () => {
  it("lists the three lessons in course order on their own pages", () => {
    assert.deepEqual(
      LESSONS.map((entry) => [entry.number, entry.id, entry.path]),
      [
        [1, "smell-memory", "/"],
        [2, "compass", "/modules/compass"],
        [3, "escape", "/modules/escape"],
      ],
    );
    assert.equal(findLesson("compass")?.module.circuit, "visual");
    assert.equal(findLesson("escape")?.module.circuit, "escape");
    assert.equal(findLesson("nope"), undefined);
  });

  it("titles the new lessons as asked", () => {
    assert.equal(
      findLesson("compass")?.lesson.title,
      "How a fly knows which way it's facing",
    );
    assert.equal(
      findLesson("escape")?.lesson.title,
      "The 30-millisecond escape",
    );
  });
});

describe("smell-memory lesson", () => {
  it("has five steps and one check question", () => {
    assert.equal(lesson.title, "How a fly remembers a smell");
    assert.equal(lesson.steps.length, 5);
    assert.equal(lesson.check.choices.filter((c) => c.correct).length, 1);
  });
});

for (const { lesson } of LESSONS)
  describe(`${lesson.id} lesson copy`, () => {
    it("has one right answer and ends each silence step with a puff", () => {
      assert.equal(lesson.check.choices.filter((c) => c.correct).length, 1);
      for (const step of lesson.steps) {
        if (step.goal.type === "silence") assert.ok(step.puff, step.id);
      }
    });

    it("keeps each step, instruction plus result, within 40 words", () => {
      for (const step of lesson.steps) {
        const words = wordCount(`${step.text} ${step.result}`);
        assert.ok(words <= MAX_STEP_WORDS, `${step.id} has ${words} words`);
      }
    });

    it("asks for exactly one tap per step", () => {
      for (const step of lesson.steps) {
        const taps = step.text.match(/\b(tap|silence)\b/gi) ?? [];
        assert.equal(taps.length, 1, `${step.id}: ${taps.join(", ")}`);
      }
    });

    it("glosses every piece of jargon in three words or fewer", () => {
      const cards = [
        ...lesson.steps.map((step) => [step.id, `${step.text} ${step.result}`]),
        [
          "check",
          [
            lesson.check.question,
            ...lesson.check.choices.flatMap((c) => [c.text, c.feedback]),
          ].join(" "),
        ],
        ["free play", lesson.freePlay.text],
      ];
      for (const [name, copy] of cards) {
        assert.deepEqual(unglossed(copy ?? "", lesson.jargon), [], name);
      }
    });

    it("only says neuron while a group is lit", () => {
      for (const step of lesson.steps) {
        if (!/neuron/i.test(`${step.text} ${step.result}`)) continue;
        assert.ok(step.focus.length > 0, step.id);
      }
      const unlit = [
        lesson.check.question,
        ...lesson.check.choices.flatMap((c) => [c.text, c.feedback]),
        lesson.freePlay.text,
      ];
      for (const copy of unlit) assert.doesNotMatch(copy, /neuron/i);
    });

    it("avoids the common passive forms", () => {
      const passive = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/i;
      for (const step of lesson.steps) {
        assert.doesNotMatch(`${step.text} ${step.result}`, passive, step.id);
      }
    });

    it("gives feedback for every answer", () => {
      for (const choice of lesson.check.choices) {
        assert.ok(choice.feedback.length > 0);
      }
    });
  });

describe("glosses", () => {
  it("splits a term from its gloss so the gloss reads as an aside", () => {
    assert.deepEqual(
      glossParts("Silence the Kenyon cells (the smell sorters) now.", [
        "Kenyon cells",
      ]),
      [
        { kind: "text", value: "Silence the " },
        { kind: "term", value: "Kenyon cells" },
        { kind: "text", value: " " },
        { kind: "gloss", value: "(the smell sorters)" },
        { kind: "text", value: " now." },
      ],
    );
    assert.deepEqual(glossParts("No jargon here.", ["Kenyon cells"]), [
      { kind: "text", value: "No jargon here." },
    ]);
  });

  it("prefers the longer term when one contains another", () => {
    const parts = glossParts("The ring neurons fire.", [
      "ring",
      "ring neurons",
    ]);
    assert.deepEqual(
      parts.filter((part) => part.kind === "term").map((part) => part.value),
      ["ring neurons"],
    );
  });
});

describe("lesson reader", () => {
  it("rejects a lesson for another circuit", () => {
    const other = { ...(raw as object), circuit: "visual" };
    assert.throws(() => readLesson(other, circuit), /not olfactory/);
  });

  it("rejects a step that locks its own goal", () => {
    const copy = structuredClone(raw) as { steps: { controls: object }[] };
    copy.steps[0]!.controls = { stimulate: [], silence: [] };
    assert.throws(() => readLesson(copy, circuit), /locks the control/);
  });

  it("rejects a check with two right answers", () => {
    const copy = structuredClone(raw) as {
      check: { choices: { correct: boolean }[] };
    };
    for (const choice of copy.check.choices) choice.correct = true;
    assert.throws(() => readLesson(copy, circuit), /exactly one correct/);
  });

  it("flags jargon with no gloss or a long one", () => {
    const jargon = ["Kenyon cells"];
    assert.deepEqual(
      unglossed("Kenyon cells (smell sorters) fire.", jargon),
      [],
    );
    assert.deepEqual(unglossed("Kenyon cells fire.", jargon), ["Kenyon cells"]);
    assert.deepEqual(
      unglossed("Kenyon cells (the cells that sort smells) fire.", jargon),
      ["Kenyon cells"],
    );
  });
});

describe("lesson controls", () => {
  const silenceStep = lesson.steps.findIndex((s) => s.goal.type === "silence");
  const before: LessonPhase = { kind: "step", index: silenceStep, done: false };
  const after: LessonPhase = { kind: "step", index: silenceStep, done: true };

  it("points at the goal and locks the rest before the learner acts", () => {
    assert.equal(controlState(lesson, before, "silence", "kc"), "cue");
    assert.equal(controlState(lesson, before, "silence", "pn"), "locked");
    assert.equal(controlState(lesson, before, "stimulate", "orn"), "locked");
    assert.equal(controlState(lesson, before, "reset"), "locked");
  });

  it("holds the silence and lets the puff replay once the goal is met", () => {
    assert.equal(controlState(lesson, after, "silence", "kc"), "locked");
    assert.equal(controlState(lesson, after, "stimulate", "orn"), "open");
  });

  it("opens every control in free play", () => {
    const free: LessonPhase = { kind: "free" };
    assert.equal(controlState(lesson, free, "silence", "mbon"), "open");
    assert.equal(controlState(lesson, free, "reset"), "open");
    assert.deepEqual(focusFor(lesson, free), []);
  });

  it("matches a goal only on the right group and direction", () => {
    const goal = { type: "silence", colorGroup: "kc", on: true } as const;
    assert.ok(meetsGoal(goal, { type: "silence", colorGroup: "kc", on: true }));
    assert.ok(
      !meetsGoal(goal, { type: "silence", colorGroup: "kc", on: false }),
    );
    assert.ok(
      !meetsGoal(goal, { type: "silence", colorGroup: "pn", on: true }),
    );
    assert.ok(!meetsGoal(goal, { type: "stimulate", colorGroup: "kc" }));
  });

  it("lights only the focused groups", () => {
    const bytes = new Uint8Array(3);
    const groups = new Map([
      ["kc", Uint32Array.of(0, 2)],
      ["mbon", Uint32Array.of(1)],
    ]);
    writeFocus(bytes, groups, ["kc"]);
    assert.deepEqual(Array.from(bytes), [255, 0, 255]);
    writeFocus(bytes, groups, []);
    assert.deepEqual(Array.from(bytes), [255, 255, 255]);
  });
});
